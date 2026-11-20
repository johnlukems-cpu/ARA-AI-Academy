import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ListChecks } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  LessonForm, DeleteLessonButton, ResourceUpload, DeleteResourceButton, AssignmentSettingsForm, MoveButtons,
} from "@/components/admin/builder";

export default async function AdminLessonEdit({ params }: PageProps<"/[locale]/admin/courses/[id]/lessons/[lessonId]">) {
  const { locale, id, lessonId } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.lessons;
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", id).maybeSingle();
  if (!lesson) notFound();
  const [{ data: content }, { data: modules }, { data: resources }, { data: assignment }, { data: quiz }] = await Promise.all([
    supabase.from("lesson_contents").select("body, video_provider, video_ref, external_url").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    supabase.from("lesson_resources").select("id, title, kind, url, locale, file_size").eq("lesson_id", lessonId).order("position"),
    supabase.from("assignments").select("instructions, submission_type, is_required, requires_review, max_score").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("quizzes").select("id, status, quiz_questions(count)").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  const res = (resources ?? []) as { id: string; title: Localized; kind: string; url: string | null; locale: string | null; file_size: number | null }[];
  const quizCount = (quiz?.quiz_questions as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;

  return (
    <>
      <Link href={`/${locale}/admin/courses/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{a.backToCourse}</Link>
      <PageHeader
        title={tr(lesson.title, locale) || a.edit}
        description={<span className="flex gap-2"><Badge>{dict.lessonTypes[lesson.type as "text"]}</Badge><Badge tone={statusTone[lesson.status]}>{dict.courseStatus[lesson.status as "draft"]}</Badge></span>}
        actions={<DeleteLessonButton id={lessonId} />}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={a.content} />
            <CardBody>
              <LessonForm
                modules={(modules ?? []).map((m, i) => ({ id: m.id, label: `${i + 1}. ${tr(m.title as Localized, locale)}` }))}
                value={{
                  id: lesson.id, module_id: lesson.module_id, type: lesson.type, status: lesson.status, title: lesson.title, summary: lesson.summary,
                  estimated_minutes: lesson.estimated_minutes, is_mandatory: lesson.is_mandatory, is_preview: lesson.is_preview,
                  body: content?.body ?? {}, video_provider: content?.video_provider ?? null, video_ref: content?.video_ref ?? {}, external_url: content?.external_url ?? null,
                }}
              />
            </CardBody>
          </Card>
          {lesson.type === "assignment" ? (
            <Card>
              <CardHeader title={a.assignmentSettings} />
              <CardBody><AssignmentSettingsForm lessonId={lessonId} value={assignment} /></CardBody>
            </Card>
          ) : null}
        </div>
        <aside className="space-y-6">
          {lesson.type === "quiz" && quiz ? (
            <Card>
              <CardHeader title={a.quizSettings} />
              <CardBody className="space-y-3">
                <p className="flex items-center gap-2 text-sm"><ListChecks className="size-4 text-brand-600" /><Badge tone={statusTone[quiz.status]}>{dict.courseStatus[quiz.status as "draft"]}</Badge><Badge>{fmt(dict.admin.courses.examQuestions, { n: quizCount })}</Badge></p>
                <p className="text-sm text-slate-600">{a.quizNotice}</p>
                <ButtonLink href={`/${locale}/admin/quizzes/${quiz.id}`} size="sm">{a.editQuiz}</ButtonLink>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title={a.resources} />
            <CardBody className="space-y-4">
              {res.length === 0 ? <p className="text-sm text-slate-500">{a.noResources}</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {res.map((r, i) => (
                    <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {r.kind === "file" ? <FileText className="size-4 shrink-0 text-brand-600" /> : <ExternalLink className="size-4 shrink-0 text-brand-600" />}
                      <a href={`/api/files/resource/${r.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate hover:text-brand-700">{tr(r.title, locale)}</a>
                      <span className="text-xs uppercase text-slate-400">{r.locale ?? "nl/en"}</span>
                      <MoveButtons kind="resource" id={r.id} first={i === 0} last={i === res.length - 1} />
                      <DeleteResourceButton id={r.id} />
                    </li>
                  ))}
                </ul>
              )}
              <ResourceUpload lessonId={lessonId} />
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
