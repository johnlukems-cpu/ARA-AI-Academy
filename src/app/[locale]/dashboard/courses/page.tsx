import { notFound } from "next/navigation";
import { BookOpen, Clock, ArrowRight, Award } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { getMyEnrollments } from "@/lib/data/student";
import { courseText } from "@/lib/data/catalog";
import { daysRemaining, formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CourseCover } from "@/components/public/course-card";

export default async function MyCoursesPage({ params }: PageProps<"/[locale]/dashboard/courses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const p = dict.portal;
  const { user } = await requireUser(locale);
  const enrollments = await getMyEnrollments(user.id);
  const live = enrollments.filter((e) => e.isLive);
  const past = enrollments.filter((e) => !e.isLive && (e.status === "active" || e.status === "expired" || e.status === "revoked"));

  return (
    <>
      <PageHeader title={p.myLearning} />
      {live.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-8" />} title={dict.learn.noCourses}>
          <ButtonLink href={`/${locale}/dashboard/browse`} className="mt-4">{p.chooseCourse}</ButtonLink>
        </EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {live.map((e) => {
            const t = courseText(e.course, locale);
            const pct = e.progress?.percentage ?? 0;
            const days = daysRemaining(e.expires_at);
            return (
              <Card key={e.id} className="overflow-hidden">
                <div className="aspect-[16/6] overflow-hidden"><CourseCover course={e.course} /></div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={days <= 7 ? "warning" : "success"}><Clock className="size-3" />{fmt(p.daysRemaining, { days })}</Badge>
                    {e.completed_at ? <Badge tone="brand"><Award className="size-3" />{dict.learn.completed}</Badge> : null}
                  </div>
                  <h2 className="mt-2 font-bold text-slate-900">{t.title}</h2>
                  <p className="text-xs text-slate-500">{fmt(p.expiresOn, { date: formatDate(e.expires_at, locale) })}</p>
                  <div className="mb-1.5 mt-4 flex justify-between text-xs font-medium text-slate-600">
                    <span>{p.progress}</span>
                    <span>{pct}% · {e.progress?.completed_lessons ?? 0}/{e.progress?.total_lessons ?? 0}</span>
                  </div>
                  <ProgressBar value={pct} label={p.progress} />
                  <ButtonLink href={`/${locale}/dashboard/courses/${e.course.slug}`} className="mt-4 w-full" size="sm">
                    {pct > 0 ? p.continue : p.start}<ArrowRight className="size-4" />
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {past.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900">{dict.learn.expiredCourses}</h2>
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70">
            {past.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-800">{courseText(e.course, locale).title}</p>
                  <p className="text-xs text-slate-500">{fmt(p.expiredOn, { date: formatDate(e.expires_at, locale) })} · {e.progress?.percentage ?? 0}%</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone[e.status === "active" ? "expired" : e.status]}>{dict.enrollmentStatus[e.status === "active" ? "expired" : e.status]}</Badge>
                  <ButtonLink href={`/${locale}/dashboard/courses/${e.course.slug}`} size="sm" variant="secondary">{dict.common.details}</ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
