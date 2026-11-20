"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActionAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailStudent } from "@/lib/notify";
import { publicEnv } from "@/lib/env";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { tr, type Localized } from "@/lib/localize";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(formData: FormData) {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const admin = await getActionAdmin();
  return { locale, dict, admin };
}

function done(locale: Locale, message: string): ActionResult {
  revalidatePath(`/${locale}/admin`, "layout");
  return { ok: true, message };
}

/** Email a certificate notification if one was issued for this student/course in the last 2 minutes. */
async function emailNewCertificate(studentId: string, courseId: string) {
  const { data } = await createAdminClient()
    .from("certificates")
    .select("code, issued_at")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("status", "valid")
    .maybeSingle();
  if (data && Date.now() - new Date(data.issued_at).getTime() < 120_000) {
    await emailStudent(studentId, "certificate_issued", {
      courseId,
      vars: {
        code: data.code,
        certificate_url: `${publicEnv.siteUrl}/api/certificates/${data.code}/pdf`,
        verify_url: `${publicEnv.siteUrl}/verify/${data.code}`,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export async function approvePayment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("payment_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_approve_payment", { p_payment_id: id.data, p_notes: str(formData, "notes") || null });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const enr = data as { student_id: string; course_id: string; expires_at: string; access_days: number };
  await emailStudent(enr.student_id, "payment_approved", { courseId: enr.course_id, expiresAt: enr.expires_at, vars: { days: enr.access_days } });
  return done(locale, dict.admin.payments.approved);
}

export async function rejectPayment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("payment_id"));
  const reason = str(formData, "reason");
  if (!id.success) return { ok: false, error: dict.errors.validation };
  if (!reason) return { ok: false, error: dict.errors.reason_required };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reject_payment", { p_payment_id: id.data, p_reason: reason, p_notes: str(formData, "notes") || null });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const p = data as { student_id: string; course_id: string };
  await emailStudent(p.student_id, "payment_rejected", { courseId: p.course_id, vars: { reason } });
  return done(locale, dict.admin.payments.rejected);
}

export async function refundPayment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("payment_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_refund_payment", {
    p_payment_id: id.data,
    p_revoke_access: formData.get("revoke") === "on",
    p_notes: str(formData, "notes") || null,
  });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  return done(locale, dict.admin.payments.refunded);
}

export async function savePaymentNotes(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("payment_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ admin_notes: str(formData, "notes").slice(0, 5000) }).eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(admin.user.id, "payment.notes", "payment", id.data);
  return done(locale, dict.admin.payments.notesSaved);
}

// ---------------------------------------------------------------------------
// Enrollments & students
// ---------------------------------------------------------------------------
export async function extendEnrollment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("enrollment_id"));
  const days = z.coerce.number().int().min(1).max(3650).safeParse(formData.get("days"));
  if (!id.success || !days.success) return { ok: false, error: dict.errors.invalid_days };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_extend_enrollment", { p_enrollment_id: id.data, p_days: days.data, p_reason: str(formData, "reason") || null });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const enr = data as { student_id: string; course_id: string; expires_at: string };
  await emailStudent(enr.student_id, "access_extended", { courseId: enr.course_id, expiresAt: enr.expires_at });
  return done(locale, dict.common.saved);
}

export async function revokeEnrollment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("enrollment_id"));
  const reason = str(formData, "reason");
  if (!id.success) return { ok: false, error: dict.errors.validation };
  if (!reason) return { ok: false, error: dict.errors.reason_required };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_enrollment", { p_enrollment_id: id.data, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  return done(locale, dict.common.saved);
}

export async function manualEnroll(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const schema = z.object({
    student_id: z.uuid(),
    course_id: z.uuid(),
    days: z.coerce.number().int().min(1).max(3650).optional(),
    amount: z.coerce.number().min(0).optional(),
    payment_method_id: z.uuid().optional(),
    reference: z.string().max(120).optional(),
    note: z.string().max(1000).optional(),
  });
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_manual_enroll", {
    p_student_id: v.student_id,
    p_course_id: v.course_id,
    p_days: v.days ?? null,
    p_amount: v.amount ?? null,
    p_payment_method_id: v.payment_method_id ?? null,
    p_reference: v.reference ?? null,
    p_note: v.note ?? null,
  });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const enr = data as { student_id: string; course_id: string; expires_at: string; access_days: number };
  await emailStudent(enr.student_id, "access_activated", { courseId: enr.course_id, expiresAt: enr.expires_at, vars: { days: enr.access_days } });
  return done(locale, dict.common.saved);
}

export async function setUserStatus(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("user_id"));
  const status = z.enum(["active", "suspended"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: id.data, p_status: status.data, p_reason: str(formData, "reason") || null });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  return done(locale, dict.common.saved);
}

export async function setUserRole(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("user_id"));
  const role = z.enum(["student", "admin"]).safeParse(formData.get("role"));
  if (!id.success || !role.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: id.data, p_role: role.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  return done(locale, dict.common.saved);
}

/** "Reset access": clear lesson progress for one course (exam history and certificates are kept). */
export async function resetProgress(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const student = z.uuid().safeParse(formData.get("user_id"));
  const course = z.uuid().safeParse(formData.get("course_id"));
  if (!student.success || !course.success) return { ok: false, error: dict.errors.validation };
  const { error } = await createAdminClient().from("lesson_progress").delete().eq("student_id", student.data).eq("course_id", course.data);
  if (error) return { ok: false, error: dict.errors.generic };
  await audit(admin.user.id, "progress.reset", "profile", student.data, { course_id: course.data });
  return done(locale, dict.common.saved);
}

export async function sendPasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });
  await audit(admin.user.id, "user.password_reset_sent", "profile", String(formData.get("user_id") ?? ""));
  return { ok: true, message: dict.admin.students.resetSent };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export async function reviewSubmission(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("submission_id"));
  const status = z.enum(["approved", "needs_revision"]).safeParse(formData.get("status"));
  const score = z.coerce.number().int().min(0).max(1000).optional().safeParse(formData.get("score") || undefined);
  if (!id.success || !status.success || !score.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_submission", {
    p_submission_id: id.data,
    p_status: status.data,
    p_score: score.data ?? null,
    p_feedback: str(formData, "feedback") || null,
  });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const sub = data as { student_id: string; course_id: string; assignment_id: string; feedback: string | null };
  const { data: asg } = await supabase.from("assignments").select("lesson:lessons(title)").eq("id", sub.assignment_id).maybeSingle();
  const { data: student } = await supabase.from("profiles").select("preferred_locale").eq("id", sub.student_id).maybeSingle();
  const sl = loc(student?.preferred_locale);
  await emailStudent(sub.student_id, "assignment_reviewed", {
    courseId: sub.course_id,
    vars: {
      assignment: tr((asg?.lesson as unknown as { title: Localized } | null)?.title, sl, ""),
      status: getDictionary(sl).submissionStatus[status.data],
      feedback: sub.feedback ?? "",
    },
  });
  if (status.data === "approved") await emailNewCertificate(sub.student_id, sub.course_id);
  return done(locale, dict.admin.submissions.reviewed);
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
export async function revokeCertificate(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("certificate_id"));
  const reason = str(formData, "reason");
  if (!id.success) return { ok: false, error: dict.errors.validation };
  if (!reason) return { ok: false, error: dict.errors.reason_required };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_certificate", { p_certificate_id: id.data, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  return done(locale, dict.admin.certificates.revoked);
}

export async function reissueCertificate(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("certificate_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reissue_certificate", { p_certificate_id: id.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const c = data as { student_id: string; course_id: string };
  await emailNewCertificate(c.student_id, c.course_id);
  return done(locale, dict.admin.certificates.reissued);
}

export async function issueCertificate(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const student = z.uuid().safeParse(formData.get("user_id"));
  const course = z.uuid().safeParse(formData.get("course_id"));
  if (!student.success || !course.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("try_issue_certificate", { p_student: student.data, p_course: course.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  if (!data) return { ok: false, error: dict.admin.certificates.notEligible };
  await emailNewCertificate(student.data, course.data);
  return done(locale, dict.admin.certificates.reissued);
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------
export async function markMessageHandled(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(formData);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("message_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").update({ handled_at: new Date().toISOString(), handled_by: admin.user.id }).eq("id", id.data);
  if (error) return { ok: false, error: dict.errors.generic };
  return done(locale, dict.common.saved);
}
