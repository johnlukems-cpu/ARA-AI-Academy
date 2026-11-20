"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getObjectInfo } from "@/lib/storage";
import { emailAdmins, emailStudent, adminUrl } from "@/lib/notify";
import { publicEnv } from "@/lib/env";
import { startAttempt, submitAttempt } from "@/lib/quiz/service";
import type { AnswerMap } from "@/lib/quiz/grading";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { getDictionary, fmt } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { tr, type Localized } from "@/lib/localize";
import { formatDate } from "@/lib/format";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");

async function certificateCheck(studentId: string, courseId: string) {
  const admin = createAdminClient();
  const before = await admin.from("certificates").select("id").eq("student_id", studentId).eq("course_id", courseId).eq("status", "valid").maybeSingle();
  if (before.data) return;
  await admin.rpc("try_issue_certificate", { p_student: studentId, p_course: courseId });
  const { data } = await admin.from("certificates").select("code").eq("student_id", studentId).eq("course_id", courseId).eq("status", "valid").maybeSingle();
  if (data) {
    await emailStudent(studentId, "certificate_issued", {
      courseId,
      vars: { code: data.code, certificate_url: `${publicEnv.siteUrl}/api/certificates/${data.code}/pdf`, verify_url: `${publicEnv.siteUrl}/verify/${data.code}` },
    });
  }
}

/** Email the student if the DB auto-issued a certificate during the last action. */
async function emailIfJustIssued(studentId: string, courseId: string) {
  const { data } = await createAdminClient()
    .from("certificates")
    .select("code, issued_at")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("status", "valid")
    .maybeSingle();
  if (data && Date.now() - new Date(data.issued_at).getTime() < 60_000) {
    await emailStudent(studentId, "certificate_issued", {
      courseId,
      vars: { code: data.code, certificate_url: `${publicEnv.siteUrl}/api/certificates/${data.code}/pdf`, verify_url: `${publicEnv.siteUrl}/verify/${data.code}` },
    });
  }
}

export async function completeLesson(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("lesson_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_lesson", { p_lesson_id: id.data });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", id.data).maybeSingle();
  if (lesson) await emailIfJustIssued(current.user.id, lesson.course_id);
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, message: dict.learn.completed };
}

const submissionSchema = z.object({
  assignment_id: z.uuid(),
  text_answer: z.string().max(20000).optional().default(""),
  link_url: z.union([z.url().max(1000), z.literal("")]).optional().default(""),
  storage_path: z.string().max(300).optional().default(""),
  file_name: z.string().max(200).optional().default(""),
});

export async function submitAssignment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  if (!(await rateLimit("assignment", 20, 3600, current.user.id))) return { ok: false, error: dict.errors.rateLimited };
  const v = parsed.data;
  if (v.storage_path) {
    if (!v.storage_path.startsWith(`${current.user.id}/`)) return { ok: false, error: dict.errors.notAuthorized };
    if (!(await getObjectInfo("assignment-files", v.storage_path))) return { ok: false, error: dict.errors.uploadFailed };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_assignment", {
    p_assignment_id: v.assignment_id,
    p_text: v.text_answer || null,
    p_link: v.link_url || null,
    p_storage_path: v.storage_path || null,
    p_file_name: v.file_name || null,
  });
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const sub = data as { id: string; course_id: string; status: string };
  const { data: asg } = await supabase.from("assignments").select("lesson:lessons(title)").eq("id", v.assignment_id).maybeSingle();
  const title = (asg?.lesson as unknown as { title: Localized } | null)?.title;
  await emailStudent(current.user.id, "assignment_submitted", { courseId: sub.course_id, vars: { assignment: tr(title, loc(current.profile.preferred_locale), "") } });
  if (sub.status === "submitted") {
    const { data: ct } = await supabase.from("course_translations").select("title").eq("course_id", sub.course_id).eq("locale", "nl").maybeSingle();
    await emailAdmins("assignment_submitted_admin", {
      student: `${current.profile.first_name} ${current.profile.last_name}`.trim(),
      course: ct?.title ?? "",
      assignment: tr(title, "nl", ""),
      admin_url: adminUrl(`/submissions`),
    });
  } else {
    await emailIfJustIssued(current.user.id, sub.course_id);
  }
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, message: dict.learn.assignmentSubmitted };
}

export async function beginQuiz(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = loc(formData.get("locale"));
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const id = z.uuid().safeParse(formData.get("quiz_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const res = await startAttempt(id.data, current.user.id, locale);
  if (!res.ok) {
    if (res.reason === "quiz_wait" && res.retryAt) return { ok: false, error: fmt(dict.quiz.retakeAvailable, { date: formatDate(res.retryAt, locale, true) }) };
    const map: Record<string, string> = {
      no_access: dict.errors.no_access,
      quiz_no_attempts: dict.quiz.noAttemptsLeft,
      already_passed: dict.quiz.passed,
      quiz_no_questions: dict.errors.quiz_no_questions,
      not_found: dict.quiz.unavailable,
    };
    return { ok: false, error: map[res.reason] ?? dict.errors.generic };
  }
  redirect(`/${locale}/dashboard/quiz/${id.data}/attempt/${res.attemptId}`);
}

export async function finishQuiz(input: { attemptId: string; answers: AnswerMap; locale: string }): Promise<ActionResult<{ quizId: string }>> {
  const locale = loc(input.locale);
  const dict = getDictionary(locale);
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  if (!z.uuid().safeParse(input.attemptId).success || typeof input.answers !== "object" || input.answers === null) return { ok: false, error: dict.errors.validation };
  const res = await submitAttempt(input.attemptId, current.user.id, input.answers);
  if (!res.ok) return { ok: false, error: res.reason === "no_access" ? dict.errors.no_access : dict.errors.generic };
  const { quiz, attempt } = res;
  if (quiz.kind === "final_exam") {
    const sl = loc(current.profile.preferred_locale);
    const sd = getDictionary(sl);
    await emailStudent(current.user.id, "exam_result", {
      courseId: quiz.course_id,
      vars: { score: attempt.percentage ?? 0, result: attempt.passed ? sd.quiz.passed : sd.quiz.failed },
    });
    await createAdminClient().from("notifications").insert({ user_id: current.user.id, type: "exam_result", payload: { course_id: quiz.course_id, score: attempt.percentage } });
  }
  if (attempt.passed) await certificateCheck(current.user.id, quiz.course_id);
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true, data: { quizId: quiz.id } };
}
