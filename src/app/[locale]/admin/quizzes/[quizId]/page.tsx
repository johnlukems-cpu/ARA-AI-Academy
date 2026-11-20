import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr, type Localized } from "@/lib/localize";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { MoveButtons } from "@/components/admin/builder";
import { QuizSettingsForm, QuestionEditor, DeleteQuestionButton, type QuestionValue, type QuizSettingsValue } from "@/components/admin/quiz-editor";

type QRow = { id: string; type: QuestionValue["type"]; prompt: Localized; explanation: Localized; points: number; accepted_answers: Partial<Record<string, string[]>>; position: number; quiz_options: { id: string; label: Localized; is_correct: boolean; position: number }[] };

export default async function AdminQuizEdit({ params }: PageProps<"/[locale]/admin/quizzes/[quizId]">) {
  const { locale, quizId } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(quizId).success) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.quizzes;
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (!quiz) notFound();
  const [{ data: questions }, { data: attempts }] = await Promise.all([
    supabase.from("quiz_questions").select("id, type, prompt, explanation, points, accepted_answers, position, quiz_options(id, label, is_correct, position)").eq("quiz_id", quizId).order("position").returns<QRow[]>(),
    supabase.from("quiz_attempts").select("id, attempt_number, status, percentage, passed, submitted_at, student:profiles!quiz_attempts_student_id_fkey(first_name, last_name, email)").eq("quiz_id", quizId).order("started_at", { ascending: false }).limit(50),
  ]);
  const list = questions ?? [];
  const back = quiz.lesson_id ? `/${locale}/admin/courses/${quiz.course_id}/lessons/${quiz.lesson_id}` : `/${locale}/admin/courses/${quiz.course_id}`;
  const rows = (attempts ?? []) as unknown as { id: string; attempt_number: number; status: string; percentage: number | null; passed: boolean | null; submitted_at: string | null; student: { first_name: string; last_name: string; email: string } | null }[];

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{quiz.lesson_id ? a.backToLesson : a.backToCourse}</Link>
      <PageHeader
        title={quiz.kind === "final_exam" ? a.examTitle : a.title}
        description={<span className="flex gap-2"><Badge tone={statusTone[quiz.status]}>{dict.courseStatus[quiz.status as "draft"]}</Badge><Badge>{fmt(dict.admin.courses.examQuestions, { n: list.length })}</Badge></span>}
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card>
            <CardHeader title={a.questions} />
            <CardBody className="space-y-4">
              {list.length === 0 ? <Alert tone="info">{a.noQuestions}</Alert> : null}
              {list.map((q, i) => {
                const value: QuestionValue = {
                  id: q.id, type: q.type, prompt: q.prompt, explanation: q.explanation, points: Number(q.points), accepted_answers: q.accepted_answers ?? {},
                  options: [...q.quiz_options].sort((x, y) => x.position - y.position).map((o) => ({ id: o.id, label: o.label, is_correct: o.is_correct })),
                };
                return (
                  <details key={q.id} className="rounded-2xl ring-1 ring-slate-200">
                    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{tr(q.prompt, locale)}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                          <Badge>{dict.questionTypes[q.type]}</Badge><Badge>{Number(q.points)} {a.points.toLowerCase()}</Badge>
                          {value.options.filter((o) => o.is_correct).map((o) => <span key={o.id} className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-3" />{tr(o.label, locale)}</span>)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MoveButtons kind="question" id={q.id} first={i === 0} last={i === list.length - 1} />
                        <DeleteQuestionButton id={q.id} />
                      </span>
                    </summary>
                    <div className="border-t border-slate-100 p-4"><QuestionEditor quizId={quizId} value={value} /></div>
                  </details>
                );
              })}
              <details className="rounded-2xl border border-dashed border-slate-300" open={list.length === 0}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700">+ {a.addQuestion}</summary>
                <div className="px-4 pb-4"><QuestionEditor quizId={quizId} /></div>
              </details>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={a.settings} />
            <CardBody><QuizSettingsForm value={quiz as unknown as QuizSettingsValue} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={a.attempts} />
            <Table>
              <thead className="bg-slate-50"><tr><Th>{dict.admin.payments.student}</Th><Th>{dict.quiz.resultTitle}</Th><Th>{dict.common.date}</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? <tr><Td colSpan={3} className="py-6 text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => (
                  <tr key={r.id}>
                    <Td><span className="text-sm font-medium">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</span><p className="text-xs text-slate-500">{fmt(dict.quiz.attempt, { n: r.attempt_number })}</p></Td>
                    <Td>{r.status === "in_progress" ? <Badge tone="info">{dict.quiz.inProgress}</Badge> : <><Badge tone={r.passed ? "success" : "danger"}>{r.passed ? dict.quiz.passed : dict.quiz.failed}</Badge> <span className="text-sm">{r.percentage ?? 0}%</span></>}</Td>
                    <Td className="whitespace-nowrap text-sm">{formatDate(r.submitted_at, locale, true)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </aside>
      </div>
    </>
  );
}
