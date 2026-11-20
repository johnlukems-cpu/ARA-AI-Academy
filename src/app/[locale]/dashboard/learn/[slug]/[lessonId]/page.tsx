import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, ExternalLink, FileText, ListChecks, MessageSquare } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudentCourse } from "@/lib/data/student";
import { courseText } from "@/lib/data/catalog";
import { tr, type Localized } from "@/lib/localize";
import { videoEmbed } from "@/lib/video";
import { lessonIcons } from "@/components/ui/lesson-icons";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";
import { LessonCompleteButton } from "@/components/student/lesson-complete";
import { AssignmentForm } from "@/components/student/assignment-form";

type Content = { body: Localized; video_provider: string | null; video_ref: Localized; external_url: string | null };
type Resource = { id: string; title: Localized; kind: "file" | "link"; locale: string | null; file_size: number | null };
type Assignment = { id: string; instructions: Localized; submission_type: "text" | "file" | "link" | "any"; requires_review: boolean };
type Submission = { id: string; status: string; text_answer: string | null; link_url: string | null; file_name: string | null; storage_path: string | null; score: number | null; feedback: string | null; submitted_at: string };

export default async function LessonPage({ params }: PageProps<"/[locale]/dashboard/learn/[slug]/[lessonId]">) {
  const { locale, slug, lessonId } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(lessonId).success) notFound();
  const dict = getDictionary(locale);
  const l = dict.learn;
  const { user } = await requireUser(locale);
  const data = await getStudentCourse(slug, user.id);
  if (!data) notFound();
  const { outline, hasAccess, progress, lessons } = data;
  const index = lessons.findIndex((x) => x.id === lessonId);
  if (index === -1) notFound();
  if (!hasAccess) redirect(`/${locale}/dashboard/courses/${slug}`);
  const lesson = lessons[index];
  const supabase = await createClient();

  // Opening the lesson counts as accessing its content.
  await supabase.rpc("record_lesson_access", { p_lesson_id: lesson.id, p_resource: false });

  const [{ data: content }, { data: resources }, { data: assignment }, { data: quiz }] = await Promise.all([
    supabase.from("lesson_contents").select("body, video_provider, video_ref, external_url").eq("lesson_id", lesson.id).maybeSingle<Content>(),
    supabase.from("lesson_resources").select("id, title, kind, locale, file_size").eq("lesson_id", lesson.id).order("position").returns<Resource[]>(),
    lesson.type === "assignment"
      ? supabase.from("assignments").select("id, instructions, submission_type, requires_review").eq("lesson_id", lesson.id).maybeSingle<Assignment>()
      : Promise.resolve({ data: null as Assignment | null }),
    lesson.type === "quiz"
      ? supabase.from("quizzes").select("id, title, passing_score").eq("lesson_id", lesson.id).eq("status", "published").maybeSingle()
      : Promise.resolve({ data: null as { id: string; title: Localized; passing_score: number } | null }),
  ]);
  const { data: submission } = assignment
    ? await supabase.from("assignment_submissions").select("id, status, text_answer, link_url, file_name, storage_path, score, feedback, submitted_at").eq("assignment_id", assignment.id).eq("student_id", user.id).maybeSingle<Submission>()
    : { data: null };

  const state = progress.get(lesson.id);
  const completed = Boolean(state?.completed);
  const body = tr(content?.body, locale, "");
  const fallbackLang = Boolean(content?.body && !content.body[locale]?.trim() && body);
  const video = lesson.type === "video" ? videoEmbed(content?.video_provider, tr(content?.video_ref, locale, "")) : null;
  const visibleResources = (resources ?? []).filter((r) => !r.locale || r.locale === locale);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const Icon = lessonIcons[lesson.type];
  const moduleIndex = outline.modules.findIndex((m) => m.id === lesson.module_id);
  const hasContent = Boolean(body || video || visibleResources.length || content?.external_url || assignment || quiz);
  const manualCompletion = lesson.type !== "quiz" && lesson.type !== "assignment";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href={`/${locale}/dashboard/courses/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
            <ArrowLeft className="size-4" />{courseText(outline, locale).title}
          </Link>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
            <span>{fmt(l.module, { n: moduleIndex + 1 })}</span><span className="text-slate-300">/</span>
            <span>{fmt(l.lessonOf, { n: index + 1, total: lessons.length })}</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">{tr(lesson.title, locale)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge><Icon className="size-3" />{dict.lessonTypes[lesson.type]}</Badge>
            {lesson.is_mandatory ? <Badge tone="brand">{l.mandatory}</Badge> : null}
            {completed ? <Badge tone="success"><CheckCircle2 className="size-3" />{l.completed}</Badge> : null}
          </div>
        </div>

        {fallbackLang ? <Alert tone="info">{l.languageFallback}</Alert> : null}
        {!hasContent ? <Alert tone="info">{l.contentPending}</Alert> : null}

        {lesson.type === "video" ? (
          video ? (
            <div className="overflow-hidden rounded-2xl bg-black shadow-card">
              {video.kind === "iframe" ? (
                <iframe src={video.src} title={tr(lesson.title, locale)} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <video src={video.src} controls preload="metadata" className="aspect-video w-full" />
              )}
            </div>
          ) : (
            <Alert tone="info">{l.videoUnavailable}</Alert>
          )
        ) : null}

        {body ? (
          <Card><CardBody><div className="prose-lesson"><ReactMarkdown>{body}</ReactMarkdown></div></CardBody></Card>
        ) : null}

        {content?.external_url && lesson.type === "external" ? (
          <a href={content.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-medium text-brand-700 hover:border-brand-300">
            <ExternalLink className="size-5" />{l.openExternal}
          </a>
        ) : null}

        {visibleResources.length ? (
          <Card>
            <CardHeader title={l.resources} description={lesson.type === "pdf" && !state?.resourceAccessed ? l.completeHintPdf : undefined} />
            <ul className="divide-y divide-slate-100">
              {visibleResources.map((r) => (
                <li key={r.id}>
                  <a href={`/api/files/resource/${r.id}`} target="_blank" rel="noopener" className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-slate-50 sm:px-6">
                    {r.kind === "file" ? <FileText className="size-4 text-brand-600" /> : <ExternalLink className="size-4 text-brand-600" />}
                    <span className="flex-1 font-medium text-slate-800">{tr(r.title, locale)}</span>
                    {r.file_size ? <span className="text-xs text-slate-400">{(r.file_size / 1024 / 1024).toFixed(1)} MB</span> : null}
                    <Download className="size-4 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {quiz ? (
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-900"><ListChecks className="size-5 text-brand-600" />{tr(quiz.title, locale)}</p>
                <p className="mt-1 text-sm text-slate-600">{completed ? l.quizPassed : l.quizIntro} · {dict.quiz.passingScore}: {quiz.passing_score}%</p>
              </div>
              <ButtonLink href={`/${locale}/dashboard/quiz/${quiz.id}`} variant={completed ? "secondary" : "primary"}>{l.openQuiz}</ButtonLink>
            </CardBody>
          </Card>
        ) : null}

        {assignment ? (
          <Card>
            <CardHeader title={l.assignment} />
            <CardBody className="space-y-5">
              {tr(assignment.instructions, locale, "") ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{l.instructions}</p>
                  <div className="prose-lesson text-sm"><ReactMarkdown>{tr(assignment.instructions, locale, "")}</ReactMarkdown></div>
                </div>
              ) : null}
              {submission ? (
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{l.yourSubmission}</p>
                    <Badge tone={statusTone[submission.status]}>{dict.submissionStatus[submission.status as "submitted"]}</Badge>
                    {submission.score !== null ? <Badge tone="brand">{l.score}: {submission.score}</Badge> : null}
                  </div>
                  {submission.feedback ? (
                    <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MessageSquare className="size-3.5" />{l.feedback}</p>
                      <p className="whitespace-pre-line">{submission.feedback}</p>
                    </div>
                  ) : null}
                  {submission.storage_path ? (
                    <a href={`/api/files/submission/${submission.id}`} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                      <FileText className="size-4" />{submission.file_name ?? l.uploadedFile}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {submission?.status === "approved" ? null : (
                <AssignmentForm
                  assignmentId={assignment.id}
                  submissionType={assignment.submission_type}
                  previous={submission ? { text_answer: submission.text_answer, link_url: submission.link_url, file_name: submission.file_name, storage_path: submission.storage_path } : null}
                  resubmit={Boolean(submission)}
                />
              )}
            </CardBody>
          </Card>
        ) : null}

        {manualCompletion ? (
          completed ? (
            <Alert tone="success">{l.lessonDone}</Alert>
          ) : (
            <Card>
              <CardBody>
                <LessonCompleteButton lessonId={lesson.id} hint={lesson.type === "video" ? l.completeHintVideo : lesson.type === "pdf" && visibleResources.length ? l.completeHintPdf : undefined} />
              </CardBody>
            </Card>
          )
        ) : null}

        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-6">
          {prev ? <ButtonLink href={`/${locale}/dashboard/learn/${slug}/${prev.id}`} variant="secondary"><ArrowLeft className="size-4" />{l.previousLesson}</ButtonLink> : <span />}
          {next ? <ButtonLink href={`/${locale}/dashboard/learn/${slug}/${next.id}`}>{l.nextLesson}<ArrowRight className="size-4" /></ButtonLink> : null}
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{l.courseContent}</p>
          {outline.modules.map((m, mi) => (
            <div key={m.id} className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold text-slate-700">{mi + 1}. {tr(m.title, locale)}</p>
              <ul>
                {m.lessons.map((x) => (
                  <li key={x.id}>
                    <Link href={`/${locale}/dashboard/learn/${slug}/${x.id}`} aria-current={x.id === lesson.id ? "page" : undefined}
                      className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs", x.id === lesson.id ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-50")}>
                      {progress.get(x.id)?.completed || (x.id === lesson.id && completed) ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" /> : <span className="size-3.5 shrink-0 rounded-full border border-slate-300" />}
                      <span className="truncate">{tr(x.title, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
