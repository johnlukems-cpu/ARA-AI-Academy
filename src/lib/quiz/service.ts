import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Localized } from "@/lib/localize";
import type { QuestionType } from "@/lib/types";
import { canStartAttempt, gradeAttempt, shuffle, type AnswerMap, type GradableQuestion } from "./grading";

export type Quiz = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  kind: "quiz" | "final_exam";
  title: Localized;
  instructions: Localized;
  passing_score: number;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  question_count: number | null;
  shuffle_questions: boolean;
  retake_wait_hours: number;
  show_correct_answers: boolean;
  status: "draft" | "published";
};

export type Attempt = {
  id: string;
  quiz_id: string;
  student_id: string;
  course_id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "expired";
  question_ids: string[];
  answers: AnswerMap;
  results: Record<string, { correct: boolean; earned: number; points: number }>;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  passed: boolean | null;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
};

export type StudentQuestion = {
  id: string;
  type: QuestionType;
  prompt: Localized;
  points: number;
  options: { id: string; label: Localized }[];
};

type FullQuestion = Omit<StudentQuestion, "options"> & {
  explanation: Localized;
  accepted_answers: Partial<Record<string, string[]>>;
  options: { id: string; label: Localized; is_correct: boolean; position: number }[];
};

const GRACE_MS = 60_000;

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const { data } = await createAdminClient().from("quizzes").select("*").eq("id", quizId).maybeSingle<Quiz>();
  return data;
}

async function hasAccess(courseId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_course_access", { p_course_id: courseId });
  return data === true;
}

async function loadQuestions(quizId: string, ids?: string[]): Promise<FullQuestion[]> {
  const admin = createAdminClient();
  let q = admin.from("quiz_questions").select("id, type, prompt, explanation, accepted_answers, points, position, quiz_options(id, label, is_correct, position)").eq("quiz_id", quizId);
  if (ids) q = q.in("id", ids);
  const { data } = await q.order("position");
  const rows = (data ?? []).map((r) => ({
    ...(r as unknown as FullQuestion),
    points: Number((r as { points: number }).points),
    options: [...((r as unknown as { quiz_options: FullQuestion["options"] }).quiz_options ?? [])].sort((a, b) => a.position - b.position),
  }));
  if (!ids) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as FullQuestion[];
}

export function sanitize(q: FullQuestion): StudentQuestion {
  return { id: q.id, type: q.type, prompt: q.prompt, points: q.points, options: q.options.map((o) => ({ id: o.id, label: o.label })) };
}

export async function listAttempts(quizId: string, studentId: string): Promise<Attempt[]> {
  const { data } = await createAdminClient().from("quiz_attempts").select("*").eq("quiz_id", quizId).eq("student_id", studentId).order("attempt_number", { ascending: false });
  return (data ?? []) as Attempt[];
}

export type StartResult = { ok: true; attemptId: string } | { ok: false; reason: "no_access" | "quiz_no_attempts" | "quiz_wait" | "already_passed" | "quiz_no_questions" | "not_found"; retryAt?: string };

/** Start (or resume) an attempt for the signed-in student. */
export async function startAttempt(quizId: string, studentId: string, locale: string): Promise<StartResult> {
  const quiz = await getQuiz(quizId);
  if (!quiz || quiz.status !== "published") return { ok: false, reason: "not_found" };
  if (!(await hasAccess(quiz.course_id))) return { ok: false, reason: "no_access" };

  const attempts = await listAttempts(quizId, studentId);
  const open = attempts.find((a) => a.status === "in_progress");
  if (open) {
    if (!open.expires_at || new Date(open.expires_at).getTime() + GRACE_MS > Date.now()) return { ok: true, attemptId: open.id };
    await finalizeAttempt(open, {}, true);
    attempts.splice(attempts.indexOf(open), 1, { ...open, status: "expired" });
  }

  const check = canStartAttempt({ maxAttempts: quiz.max_attempts, retakeWaitHours: quiz.retake_wait_hours, kind: quiz.kind }, attempts);
  if (!check.ok) return { ok: false, reason: check.reason, retryAt: check.retryAt?.toISOString() };

  const all = await loadQuestions(quizId);
  if (all.length === 0) return { ok: false, reason: "quiz_no_questions" };
  let ids = all.map((q) => q.id);
  if (quiz.shuffle_questions) ids = shuffle(ids);
  if (quiz.question_count && quiz.question_count < ids.length) ids = ids.slice(0, quiz.question_count);

  const admin = createAdminClient();
  const { data: enr } = await admin.from("enrollments").select("id").eq("student_id", studentId).eq("course_id", quiz.course_id).eq("status", "active").maybeSingle();
  const now = new Date();
  const { data, error } = await admin
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: studentId,
      course_id: quiz.course_id,
      enrollment_id: enr?.id ?? null,
      attempt_number: (attempts[0]?.attempt_number ?? 0) + 1,
      question_ids: ids,
      locale,
      started_at: now.toISOString(),
      expires_at: quiz.time_limit_minutes ? new Date(now.getTime() + quiz.time_limit_minutes * 60_000).toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    // A concurrent request may have created the attempt; resume it.
    const again = (await listAttempts(quizId, studentId)).find((a) => a.status === "in_progress");
    if (again) return { ok: true, attemptId: again.id };
    throw new Error(error?.message ?? "attempt insert failed");
  }
  return { ok: true, attemptId: data.id };
}

export async function getAttemptForStudent(attemptId: string, studentId: string) {
  const { data } = await createAdminClient().from("quiz_attempts").select("*").eq("id", attemptId).eq("student_id", studentId).maybeSingle<Attempt>();
  if (!data) return null;
  const quiz = await getQuiz(data.quiz_id);
  if (!quiz) return null;
  const questions = await loadQuestions(data.quiz_id, data.question_ids);
  return { attempt: data, quiz, questions };
}

async function finalizeAttempt(attempt: Attempt, answers: AnswerMap, expired: boolean) {
  const quiz = await getQuiz(attempt.quiz_id);
  if (!quiz) throw new Error("quiz missing");
  const questions = await loadQuestions(attempt.quiz_id, attempt.question_ids);
  const gradable: GradableQuestion[] = questions.map((q) => ({ id: q.id, type: q.type, points: q.points, options: q.options, accepted_answers: q.accepted_answers }));
  const g = gradeAttempt(gradable, expired ? {} : answers, quiz.passing_score);
  const admin = createAdminClient();
  const { data } = await admin
    .from("quiz_attempts")
    .update({
      status: expired ? "expired" : "submitted",
      answers: expired ? {} : answers,
      results: g.results,
      score: g.score,
      max_score: g.maxScore,
      percentage: g.percentage,
      passed: expired ? false : g.passed,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress")
    .select("*")
    .maybeSingle<Attempt>();
  return { quiz, attempt: data };
}

export type SubmitResult = { ok: true; attempt: Attempt; quiz: Quiz; lateSubmission: boolean } | { ok: false; reason: "not_found" | "already_submitted" | "no_access" };

/** Grade and store a submitted attempt. Late submissions (beyond the grace period) score zero. */
export async function submitAttempt(attemptId: string, studentId: string, answers: AnswerMap): Promise<SubmitResult> {
  const { data: attempt } = await createAdminClient().from("quiz_attempts").select("*").eq("id", attemptId).eq("student_id", studentId).maybeSingle<Attempt>();
  if (!attempt) return { ok: false, reason: "not_found" };
  if (attempt.status !== "in_progress") return { ok: false, reason: "already_submitted" };
  if (!(await hasAccess(attempt.course_id))) return { ok: false, reason: "no_access" };

  // Only keep answers for questions in this attempt.
  const clean: AnswerMap = {};
  for (const id of attempt.question_ids) {
    const v = answers[id];
    if (typeof v === "string") clean[id] = v.slice(0, 500);
    else if (Array.isArray(v)) clean[id] = v.filter((x) => typeof x === "string").slice(0, 20);
  }
  const late = Boolean(attempt.expires_at && Date.now() > new Date(attempt.expires_at).getTime() + GRACE_MS);
  const { quiz, attempt: saved } = await finalizeAttempt(attempt, clean, late);
  if (!saved) return { ok: false, reason: "already_submitted" };

  // A passed lesson quiz completes its lesson.
  if (saved.passed && quiz.lesson_id) {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("lesson_progress").select("completed_at").eq("student_id", studentId).eq("lesson_id", quiz.lesson_id).maybeSingle();
    if (existing) {
      if (!existing.completed_at) await admin.from("lesson_progress").update({ completed_at: new Date().toISOString() }).eq("student_id", studentId).eq("lesson_id", quiz.lesson_id);
    } else {
      await admin.from("lesson_progress").insert({ student_id: studentId, lesson_id: quiz.lesson_id, course_id: quiz.course_id, completed_at: new Date().toISOString() });
    }
  }
  return { ok: true, attempt: saved, quiz, lateSubmission: late };
}

export type ReviewItem = {
  question: StudentQuestion & { explanation: Localized };
  answer: AnswerMap[string];
  correct: boolean;
  correctOptionIds: string[];
  acceptedAnswers: string[];
};

/** Build the post-submission review (answer key only when the quiz allows it). */
export async function buildReview(attempt: Attempt, quiz: Quiz, locale: string): Promise<ReviewItem[]> {
  const questions = await loadQuestions(attempt.quiz_id, attempt.question_ids);
  return questions.map((q) => ({
    question: { ...sanitize(q), explanation: quiz.show_correct_answers ? q.explanation : {} },
    answer: attempt.answers?.[q.id],
    correct: attempt.results?.[q.id]?.correct ?? false,
    correctOptionIds: quiz.show_correct_answers ? q.options.filter((o) => o.is_correct).map((o) => o.id) : [],
    acceptedAnswers: quiz.show_correct_answers ? (q.accepted_answers?.[locale] ?? Object.values(q.accepted_answers ?? {}).flat() ?? []).slice(0, 3) as string[] : [],
  }));
}
