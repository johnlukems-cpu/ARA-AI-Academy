import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, CheckCircle2, Clock, ListChecks, Target, Repeat } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuiz, listAttempts } from "@/lib/quiz/service";
import { canStartAttempt } from "@/lib/quiz/grading";
import { tr } from "@/lib/localize";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/misc";
import { BeginQuizButton } from "@/components/student/begin-quiz";

export default async function QuizPage({ params }: PageProps<"/[locale]/dashboard/quiz/[quizId]">) {
  const { locale, quizId } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(quizId).success) notFound();
  const dict = getDictionary(locale);
  const q = dict.quiz;
  const { user } = await requireUser(locale);
  const quiz = await getQuiz(quizId);
  if (!quiz || quiz.status !== "published") notFound();
  const supabase = await createClient();
  const { data: access } = await supabase.rpc("has_course_access", { p_course_id: quiz.course_id });
  const [{ data: course }, { count: questionTotal }] = await Promise.all([
    supabase.from("courses").select("slug").eq("id", quiz.course_id).maybeSingle(),
    createAdminClient().from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quiz.id),
  ]);
  const attempts = await listAttempts(quiz.id, user.id);
  const open = attempts.find((a) => a.status === "in_progress");
  const finished = attempts.filter((a) => a.status !== "in_progress");
  const best = finished.reduce<number | null>((m, a) => (a.percentage !== null && (m === null || a.percentage > m) ? a.percentage : m), null);
  const passed = finished.some((a) => a.passed);
  const check = canStartAttempt({ maxAttempts: quiz.max_attempts, retakeWaitHours: quiz.retake_wait_hours, kind: quiz.kind }, attempts);
  const nQuestions = Math.min(quiz.question_count ?? Infinity, questionTotal ?? 0);
  const backHref = course ? (quiz.lesson_id ? `/${locale}/dashboard/learn/${course.slug}/${quiz.lesson_id}` : `/${locale}/dashboard/courses/${course.slug}`) : `/${locale}/dashboard/courses`;
  const instructions = tr(quiz.instructions, locale, "");

  return (
    <>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{q.backToCourse}</Link>
      <PageHeader title={tr(quiz.title, locale) || (quiz.kind === "final_exam" ? q.finalExamTitle : "Quiz")} description={quiz.kind === "final_exam" ? dict.learn.examIntro : dict.learn.quizIntro} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={q.questions} value={nQuestions || "–"} icon={<ListChecks className="size-4" />} />
        <StatCard label={q.timeLimit} value={quiz.time_limit_minutes ? fmt(q.minutes, { n: quiz.time_limit_minutes }) : q.noTimeLimit} icon={<Clock className="size-4" />} />
        <StatCard label={q.passingScore} value={`${quiz.passing_score}%`} icon={<Target className="size-4" />} />
        <StatCard label={q.attempts} value={quiz.max_attempts ? fmt(q.attemptsUsed, { used: finished.length, max: quiz.max_attempts }) : q.unlimited} icon={<Repeat className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {instructions ? (
            <Card>
              <CardHeader title={q.instructions} />
              <CardBody><div className="prose-lesson text-sm"><ReactMarkdown>{instructions}</ReactMarkdown></div></CardBody>
            </Card>
          ) : null}

          {finished.length ? (
            <Card>
              <CardHeader title={q.history} />
              <Table>
                <thead><tr><Th>#</Th><Th>{dict.common.date}</Th><Th>{q.resultTitle}</Th><Th /></tr></thead>
                <tbody>
                  {finished.map((a) => (
                    <tr key={a.id}>
                      <Td>{fmt(q.attempt, { n: a.attempt_number })}</Td>
                      <Td>{formatDate(a.submitted_at ?? a.started_at, locale, true)}</Td>
                      <Td>
                        <Badge tone={a.passed ? "success" : "danger"}>{a.passed ? q.passed : q.failed}</Badge>
                        <span className="ml-2 text-sm text-slate-600">{a.percentage ?? 0}%</span>
                      </Td>
                      <Td className="text-right"><Link href={`/${locale}/dashboard/quiz/${quiz.id}/attempt/${a.id}`} className="text-sm font-medium text-brand-700 hover:underline">{dict.common.details}</Link></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>

        <aside>
          <Card>
            <CardBody className="space-y-4">
              {best !== null ? <p className="flex items-center gap-2 text-sm text-slate-600">{q.bestScore}: <span className="font-semibold text-slate-900">{best}%</span>{passed ? <Badge tone="success">{q.passed}</Badge> : null}</p> : null}
              {!access ? (
                <Alert tone="warning">{dict.errors.no_access}</Alert>
              ) : passed && quiz.kind === "final_exam" ? (
                <Alert tone="success"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" />{q.passed}</span></Alert>
              ) : open ? (
                <BeginQuizButton quizId={quiz.id} label={q.resume} />
              ) : !nQuestions ? (
                <Alert tone="info">{q.unavailable}</Alert>
              ) : check.ok ? (
                <>
                  {quiz.max_attempts ? <p className="text-sm text-slate-600">{fmt(q.attemptsLeft, { n: Math.max(0, quiz.max_attempts - finished.length) })}</p> : null}
                  <BeginQuizButton quizId={quiz.id} label={finished.length ? q.retake : q.start} />
                </>
              ) : check.reason === "quiz_wait" && check.retryAt ? (
                <Alert tone="info">{fmt(q.retakeAvailable, { date: formatDate(check.retryAt.toISOString(), locale, true) })}</Alert>
              ) : (
                <Alert tone="warning">{q.noAttemptsLeft}</Alert>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
