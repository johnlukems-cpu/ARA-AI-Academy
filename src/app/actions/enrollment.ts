"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getObjectInfo } from "@/lib/storage";
import { emailAdmins, emailStudent, adminUrl, moneyFor } from "@/lib/notify";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { tr } from "@/lib/localize";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");

export async function requestEnrollment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const courseId = z.uuid().safeParse(formData.get("course_id"));
  if (!courseId.success) return { ok: false, error: dict.errors.validation };
  if (!(await rateLimit("enroll", 10, 3600, current.user.id))) return { ok: false, error: dict.errors.rateLimited };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_enrollment", { p_course_id: courseId.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  // Email payment instructions only for a newly created request
  const created = data && Date.now() - new Date((data as { requested_at: string }).requested_at).getTime() < 60_000;
  if (created) await emailStudent(current.user.id, "enrollment_submitted", { courseId: courseId.data });
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, message: dict.enroll.requestCreated };
}

export async function cancelEnrollment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("enrollment_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_enrollment_request", { p_enrollment_id: id.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, message: dict.enroll.cancelled };
}

const evidenceSchema = z
  .array(z.object({ storage_path: z.string().max(300), file_name: z.string().max(200), mime_type: z.string().max(120), file_size: z.number().int().positive() }))
  .max(3);

const paymentSchema = z.object({
  enrollment_id: z.uuid(),
  payment_method_id: z.uuid(),
  payment_date: z.iso.date(),
  reference: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  evidence: z.string().optional().default("[]"),
});

export async function submitPayment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  if (!(await rateLimit("payment", 10, 3600, current.user.id))) return { ok: false, error: dict.errors.rateLimited };

  let evidence: z.infer<typeof evidenceSchema>;
  try {
    evidence = evidenceSchema.parse(JSON.parse(parsed.data.evidence));
  } catch {
    return { ok: false, error: dict.errors.validation };
  }
  // Every file must be in the student's own folder and actually exist in storage.
  for (const f of evidence) {
    if (!f.storage_path.startsWith(`${current.user.id}/`)) return { ok: false, error: dict.errors.notAuthorized };
    const info = await getObjectInfo("payment-proofs", f.storage_path);
    if (!info) return { ok: false, error: dict.errors.uploadFailed };
    f.file_size = info.size || f.file_size;
    f.mime_type = info.mimetype || f.mime_type;
  }

  const supabase = await createClient();
  const { data: payment, error } = await supabase.rpc("submit_payment", {
    p_enrollment_id: parsed.data.enrollment_id,
    p_payment_method_id: parsed.data.payment_method_id,
    p_payment_date: parsed.data.payment_date,
    p_reference: parsed.data.reference,
    p_note: parsed.data.note || null,
    p_evidence: evidence,
  });
  if (error) return { ok: false, error: errorMessage(dict, error) };

  const p = payment as { id: string; amount: number; currency: string; course_id: string; reference: string | null; payment_method_id: string };
  const [{ data: course }, { data: method }] = await Promise.all([
    supabase.from("course_translations").select("title").eq("course_id", p.course_id).eq("locale", "nl").maybeSingle(),
    supabase.from("payment_methods").select("name").eq("id", p.payment_method_id).maybeSingle(),
  ]);
  await emailAdmins("payment_submitted_admin", {
    student: `${current.profile.first_name} ${current.profile.last_name}`.trim(),
    email: current.profile.email,
    course: course?.title ?? "",
    amount: moneyFor(p.amount, p.currency),
    method: tr(method?.name, "nl", ""),
    reference: p.reference ?? "—",
    admin_url: adminUrl(`/payments/${p.id}`),
  });
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, message: dict.enroll.paymentSubmitted };
}
