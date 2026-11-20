import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, Award, GraduationCap, Lock, ArrowRight } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudentCourse, getCompletion } from "@/lib/data/student";
import { courseText } from "@/lib/data/catalog";
import { daysRemaining, formatDate } from "@/lib/format";
import { tr } from "@/lib/localize";
import { lessonIcons } from "@/components/ui/lesson-icons";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";

function Req({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />}
      <span className={ok ? "text-slate-800" : "text-slate-600"}>
        {label}
        {detail ? <span className="ml-1 text-slate-400">({detail})</span> : null}
      </span>
    </li>
  );
}

export default async function StudentCoursePage({ params }: PageProps<"/[locale]/dashboard/courses/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const l = dict.learn;
  const { user } = await requireUser(locale);
  const data = await getStudentCourse(slug, user.id);
  if (!data || !data.enrollment) notFound();
  const { outline, enrollment, hasAccess, progress, lessons } = data;
  const t = courseText(outline, locale);
  const supabase = await createClient();

  const [completion, { data: exam }, { data: cert }] = await Promise.all([
    getCompletion(user.id, outline.id),
    supabase.from("quizzes").select("id, title").eq("course_id", outline.id).eq("kind", "final_exam").eq("status", "published").maybeSingle(),
    supabase.from("certificates").select("code, issued_at").eq("student_id", user.id).eq("course_id", outline.id).eq("status", "valid").maybeSingle(),
  ]);

  const done = lessons.filter((x) => progress.get(x.id)?.completed).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const nextLesson = lessons.find((x) => !progress.get(x.id)?.completed) ?? lessons[0];
  const days = daysRemaining(enrollment.expires_at);
  const numberOf = new Map(lessons.map((x, i) => [x.id, i + 1]));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle ?? undefined}
        actions={hasAccess && nextLesson ? (
          <ButtonLink href={`/${locale}/dashboard/learn/${slug}/${nextLesson.id}`}>{done > 0 ? dict.portal.continue : dict.portal.start}<ArrowRight className="size-4" /></ButtonLink>
        ) : null}
      />

      {!hasAccess ? (
        <Alert tone="warning" title={enrollment.status === "revoked" ? l.noAccessTitle : l.expiredTitle} className="mb-6">
          {enrollment.status === "revoked" ? l.noAccessText : l.expiredText}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {outline.modules.map((m, mi) => (
            <Card key={m.id}>
              <CardHeader title={<><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-brand-600">{fmt(l.module, { n: mi + 1 })}</span>{tr(m.title, locale)}</>} />
              <ul className="divide-y divide-slate-100">
                {m.lessons.map((lesson) => {
                  const st = progress.get(lesson.id);
                  const Icon = lessonIcons[lesson.type];
                  const inner = (
                    <>
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", st?.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {st?.completed ? <CheckCircle2 className="size-4" /> : numberOf.get(lesson.id)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{tr(lesson.title, locale)}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <Icon className="size-3.5" />{dict.lessonTypes[lesson.type]}
                          {lesson.estimated_minutes ? <><span>·</span>{fmt(l.minutes, { n: lesson.estimated_minutes })}</> : null}
                          {lesson.is_mandatory ? null : <><span>·</span>{dict.common.optional}</>}
                        </span>
                      </span>
                      {!hasAccess ? <Lock className="size-4 text-slate-300" /> : null}
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {hasAccess ? (
                        <Link href={`/${locale}/dashboard/learn/${slug}/${lesson.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 sm:px-6">{inner}</Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3 opacity-70 sm:px-6">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardBody>
              {hasAccess ? (
                <Badge tone={days <= 7 ? "warning" : "success"}><Clock className="size-3" />{fmt(dict.portal.daysRemaining, { days })}</Badge>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {fmt(hasAccess ? dict.portal.expiresOn : dict.portal.expiredOn, { date: formatDate(enrollment.expires_at, locale) })}
              </p>
              <div className="mb-1.5 mt-4 flex justify-between text-xs font-medium text-slate-600">
                <span>{dict.portal.progress}</span>
                <span>{pct}% · {done}/{lessons.length}</span>
              </div>
              <ProgressBar value={pct} label={dict.portal.progress} />
            </CardBody>
          </Card>

          {completion ? (
            <Card>
              <CardHeader title={l.requirementsTitle} />
              <CardBody>
                {!completion.certificate_enabled ? (
                  <p className="text-sm text-slate-600">{l.certificateDisabled}</p>
                ) : (
                  <ul className="space-y-2.5">
                    <Req ok={completion.lessons_ok} label={l.reqLessons} detail={`${completion.lessons_done}/${completion.lessons_total}`} />
                    {completion.assignments_total > 0 ? (
                      <Req ok={completion.assignments_ok} label={l.reqAssignments} detail={`${completion.assignments_done}/${completion.assignments_total}`} />
                    ) : null}
                    {completion.exam_required ? (
                      <Req ok={completion.exam_ok} label={l.reqExam} detail={completion.exam_best !== null ? `${completion.exam_best}%` : undefined} />
                    ) : null}
                  </ul>
                )}
                {cert ? (
                  <div className="mt-5 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Award className="size-4" />{l.certificateReady}</p>
                    <ButtonLink href={`/${locale}/dashboard/certificates`} size="sm" className="mt-3">{l.viewCertificate}</ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {exam ? (
            <Card>
              <CardBody>
                <p className="flex items-center gap-2 font-semibold text-slate-900"><GraduationCap className="size-5 text-brand-600" />{tr(exam.title, locale) || l.finalExam}</p>
                <p className="mt-1 text-sm text-slate-600">{l.examIntro}</p>
                {hasAccess ? <ButtonLink href={`/${locale}/dashboard/quiz/${exam.id}`} size="sm" className="mt-4 w-full">{l.takeExam}</ButtonLink> : null}
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
