import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Award } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAttemptForStudent, sanitize, buildReview } from "@/lib/quiz/service";
import { tr } from "@/lib/localize";
import { msUntil } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { QuizRunner } from "@/components/student/quiz-runner";

export default async function AttemptPage({ params }: PageProps<"/[locale]/dashboard/quiz/[quizId]/attempt/[attemptId]">) {
  const { locale, quizId, attemptId } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(attemptId).success) notFound();
  const dict = getDictionary(locale);
  const q = dict.quiz;
  const { user } = await requireUser(locale);
  const data = await getAttemptForStudent(attemptId, user.id);
  if (!data || data.quiz.id !== quizId) notFound();
  const { attempt, quiz, questions } = data;
  const title = tr(quiz.title, locale) || (quiz.kind === "final_exam" ? q.finalExamTitle : "Quiz");
  const back = `/${locale}/dashboard/quiz/${quiz.id}`;

  if (attempt.status === "in_progress") {
    const remainingMs = msUntil(attempt.expires_at);
    return (
      <>
        <PageHeader title={title} description={fmt(q.attempt, { n: attempt.attempt_number })} />
        <div className="mx-auto max-w-3xl">
          <QuizRunner attemptId={attempt.id} questions={questions.map(sanitize)} remainingMs={remainingMs} />
        </div>
      </>
    );
  }

  const review = await buildReview(attempt, quiz, locale);
  const supabase = await createClient();
  const { data: cert } = attempt.passed
    ? await supabase.from("certificates").select("code").eq("student_id", user.id).eq("course_id", quiz.course_id).eq("status", "valid").maybeSingle()
    : { data: null };

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{title}</Link>
      <PageHeader title={q.resultTitle} description={`${title} · ${fmt(q.attempt, { n: attempt.attempt_number })}`} />
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className={cn("overflow-hidden", attempt.passed ? "ring-emerald-200" : "ring-rose-200")}>
          <CardBody className={cn("flex flex-wrap items-center gap-5", attempt.passed ? "bg-emerald-50/60" : "bg-rose-50/60")}>
            <div className={cn("grid size-20 place-items-center rounded-full font-display text-2xl font-bold", attempt.passed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
              {attempt.percentage ?? 0}%
            </div>
            <div className="flex-1">
              <p className="font-display text-xl font-bold text-slate-900">{attempt.passed ? q.passed : q.failed}</p>
              <p className="text-sm text-slate-600">{fmt(q.pointsOf, { score: attempt.score ?? 0, max: attempt.max_score ?? 0 })} · {q.passingScore}: {quiz.passing_score}%</p>
            </div>
          </CardBody>
        </Card>

        {attempt.status === "expired" ? <Alert tone="warning">{q.lateSubmission}</Alert> : null}
        {cert ? (
          <Alert tone="success" title={dict.learn.certificateReady}>
            <ButtonLink href={`/${locale}/dashboard/certificates`} size="sm" className="mt-2"><Award className="size-4" />{dict.learn.viewCertificate}</ButtonLink>
          </Alert>
        ) : null}

        {!quiz.show_correct_answers ? <Alert tone="info">{q.reviewHidden}</Alert> : null}

        {review.map((item, i) => {
          const picked = Array.isArray(item.answer) ? item.answer : typeof item.answer === "string" ? [item.answer] : [];
          return (
            <Card key={item.question.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  {item.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label={q.correct} /> : <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" aria-label={q.incorrect} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fmt(q.question, { n: i + 1, total: review.length })}</p>
                    <p className="mt-1 font-medium whitespace-pre-line text-slate-900">{tr(item.question.prompt, locale)}</p>
                    {item.question.type === "short_answer" ? (
                      <div className="mt-3 space-y-1 text-sm">
                        <p><span className="text-slate-500">{q.yourAnswer}:</span> {picked[0] || <em className="text-slate-400">{q.noAnswer}</em>}</p>
                        {item.acceptedAnswers.length ? <p><span className="text-slate-500">{q.correctAnswer}:</span> {item.acceptedAnswers.join(" / ")}</p> : null}
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-1.5">
                        {item.question.options.map((o) => {
                          const chosen = picked.includes(o.id);
                          const right = item.correctOptionIds.includes(o.id);
                          return (
                            <li key={o.id} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1",
                              right ? "bg-emerald-50 ring-emerald-200" : chosen && quiz.show_correct_answers ? "bg-rose-50 ring-rose-200" : chosen ? "bg-slate-100 ring-slate-300" : "ring-slate-200")}>
                              <span className="flex-1">{tr(o.label, locale)}</span>
                              {chosen ? <span className="text-xs font-medium text-slate-500">{q.yourAnswer}</span> : null}
                              {right ? <CheckCircle2 className="size-4 text-emerald-600" aria-label={q.correctAnswer} /> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {tr(item.question.explanation, locale, "") ? (
                      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">{q.explanation}:</span> {tr(item.question.explanation, locale)}</p>
                    ) : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        <div className="flex justify-end"><ButtonLink href={back} variant="secondary">{q.backToCourse}</ButtonLink></div>
      </div>
    </>
  );
}
