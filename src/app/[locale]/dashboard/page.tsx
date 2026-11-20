import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CheckCircle2, ListTodo, Award, Clock, ArrowRight, ClipboardCheck, AlertCircle } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyEnrollments, getCompletion } from "@/lib/data/student";
import { courseText } from "@/lib/data/catalog";
import { daysRemaining, formatDate } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CourseCover } from "@/components/public/course-card";

export default async function DashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { verified } = await searchParams;
  const dict = getDictionary(locale);
  const p = dict.portal;
  const { user, profile, emailConfirmed } = await requireUser(locale);
  const supabase = await createClient();
  const enrollments = await getMyEnrollments(user.id);
  const live = enrollments.filter((e) => e.isLive);
  const pending = enrollments.filter((e) => e.status === "pending");
  const expired = enrollments.filter((e) => e.status === "expired" || (e.status === "active" && !e.isLive));

  const completions = new Map(
    await Promise.all(live.map(async (e) => [e.course_id, await getCompletion(user.id, e.course_id)] as const)),
  );
  const { count: certCount } = await supabase.from("certificates").select("id", { count: "exact", head: true }).eq("student_id", user.id).eq("status", "valid");

  const completedLessons = live.reduce((n, e) => n + (e.progress?.completed_lessons ?? 0), 0);
  const totalLessons = live.reduce((n, e) => n + (e.progress?.total_lessons ?? 0), 0);

  // Open assignments in active courses
  let openAssignments: { id: string; title: Localized; courseSlug: string; lessonId: string; courseTitle: string; status: string | null }[] = [];
  if (live.length) {
    const { data: asg } = await supabase
      .from("assignments")
      .select("id, lesson_id, course_id, lesson:lessons!inner(id, title, status), assignment_submissions(status, student_id)")
      .in("course_id", live.map((e) => e.course_id))
      .eq("lesson.status", "published");
    openAssignments = ((asg ?? []) as unknown as { id: string; lesson_id: string; course_id: string; lesson: { title: Localized }; assignment_submissions: { status: string; student_id: string }[] }[])
      .map((a) => {
        const sub = a.assignment_submissions.find((s) => s.student_id === user.id);
        const enr = live.find((e) => e.course_id === a.course_id)!;
        return { id: a.id, title: a.lesson.title, courseSlug: enr.course.slug, lessonId: a.lesson_id, courseTitle: courseText(enr.course, locale).title, status: sub?.status ?? null };
      })
      .filter((a) => a.status === null || a.status === "needs_revision")
      .slice(0, 5);
  }

  return (
    <>
      <PageHeader title={fmt(p.welcome, { name: profile.first_name || profile.email })} description={p.welcomeText} />
      <div className="space-y-4">
        {verified ? <Alert tone="success">{dict.auth.verified}</Alert> : null}
        {!emailConfirmed ? <Alert tone="warning">{p.unverifiedEmail}</Alert> : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={p.enrolledCourses} value={live.length} icon={<BookOpen className="size-4" />} />
        <StatCard label={p.completedLessons} value={completedLessons} icon={<CheckCircle2 className="size-4" />} />
        <StatCard label={p.remainingLessons} value={Math.max(0, totalLessons - completedLessons)} icon={<ListTodo className="size-4" />} />
        <StatCard label={p.certificatesEarned} value={certCount ?? 0} icon={<Award className="size-4" />} />
      </div>

      {pending.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title={p.pendingTitle} />
          <ul className="divide-y divide-slate-100">
            {pending.map((e) => {
              const t = courseText(e.course, locale);
              const state = e.latestPayment?.status === "pending" ? "review" : e.latestPayment?.status === "rejected" ? "rejected" : "pay";
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <div>
                    <p className="font-semibold text-slate-900">{t.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {state === "review" ? p.awaitingReview : state === "rejected" ? p.paymentRejected : dict.enrollmentStatus.pending}
                    </p>
                  </div>
                  <ButtonLink href={`/${locale}/dashboard/enroll/${e.course.slug}`} variant={state === "review" ? "secondary" : "primary"} size="sm">
                    {state === "review" ? dict.common.details : p.completePayment}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">{p.myLearning}</h2>
        {live.length === 0 ? (
          <EmptyState className="mt-4" icon={<BookOpen className="size-8" />} title={p.noEnrollments}>
            <ButtonLink href={`/${locale}/dashboard/browse`} className="mt-4">{p.chooseCourse}</ButtonLink>
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {live.map((e) => {
              const t = courseText(e.course, locale);
              const c = completions.get(e.course_id);
              const days = daysRemaining(e.expires_at);
              const pct = e.progress?.percentage ?? 0;
              return (
                <Card key={e.id} className="overflow-hidden">
                  <div className="flex gap-4 p-5">
                    <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl sm:block"><CourseCover course={e.course} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={days <= 7 ? "warning" : "success"}><Clock className="size-3" />{fmt(p.daysRemaining, { days })}</Badge>
                        {e.completed_at ? <Badge tone="brand"><Award className="size-3" />{dict.learn.completed}</Badge> : null}
                      </div>
                      <h3 className="mt-2 truncate font-bold text-slate-900">{t.title}</h3>
                      <p className="text-xs text-slate-500">{fmt(p.expiresOn, { date: formatDate(e.expires_at, locale) })}</p>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
                      <span>{p.progress}</span>
                      <span>{pct}% · {e.progress?.completed_lessons ?? 0}/{e.progress?.total_lessons ?? 0}</span>
                    </div>
                    <ProgressBar value={pct} label={p.progress} />
                    {c?.exam_available ? (
                      <p className="mt-3 text-xs text-slate-600">
                        <span className="font-medium">{p.examStatus}:</span>{" "}
                        {c.exam_passed ? fmt(p.examPassed, { score: c.exam_best ?? "" }) : c.exam_best !== null ? fmt(p.examFailed, { score: c.exam_best }) : p.examNotTaken}
                      </p>
                    ) : null}
                    <ButtonLink href={`/${locale}/dashboard/courses/${e.course.slug}`} className="mt-4 w-full" size="sm">
                      {pct > 0 ? p.continue : p.start}
                      <ArrowRight className="size-4" />
                    </ButtonLink>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {live.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title={p.upcomingAssignments} />
          <CardBody>
            {openAssignments.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noAssignments}</p>
            ) : (
              <ul className="space-y-2">
                {openAssignments.map((a) => (
                  <li key={a.id}>
                    <Link href={`/${locale}/dashboard/learn/${a.courseSlug}/${a.lessonId}`} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                      {a.status === "needs_revision" ? <AlertCircle className="size-4 text-amber-500" /> : <ClipboardCheck className="size-4 text-brand-600" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{tr(a.title, locale)}</span>
                        <span className="block truncate text-xs text-slate-500">{a.courseTitle}</span>
                      </span>
                      {a.status ? <Badge tone={statusTone[a.status]}>{dict.submissionStatus[a.status as "needs_revision"]}</Badge> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {expired.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title={dict.enrollmentStatus.expired} />
          <ul className="divide-y divide-slate-100">
            {expired.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div>
                  <p className="font-medium text-slate-800">{courseText(e.course, locale).title}</p>
                  <p className="text-xs text-slate-500">{fmt(p.expiredOn, { date: formatDate(e.expires_at, locale) })} · {e.progress?.percentage ?? 0}%</p>
                </div>
                <Badge tone={statusTone.expired}>{dict.enrollmentStatus.expired}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
