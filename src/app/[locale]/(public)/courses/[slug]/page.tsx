import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, Languages, Award, KeyRound, CheckCircle2, Target, Users, GraduationCap } from "lucide-react";
import { lessonIcons } from "@/components/ui/lesson-icons";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { courseText, getCourseOutline } from "@/lib/data/catalog";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { tr } from "@/lib/localize";
import type { Enrollment } from "@/lib/types";
import { Container } from "@/components/public/section";
import { CourseCover } from "@/components/public/course-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[locale]/courses/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const course = await getCourseOutline(slug);
  if (!course) return {};
  const t = courseText(course, locale);
  return { title: t.title, description: t.subtitle ?? t.description ?? undefined };
}

export default async function CourseDetailPage({ params }: PageProps<"/[locale]/courses/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const course = await getCourseOutline(slug);
  if (!course || course.status !== "published") notFound();
  const t = courseText(course, locale);
  const current = await getCurrentUser();

  let enrollment: Enrollment | null = null;
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_id", course.id)
      .eq("student_id", current.user.id)
      .in("status", ["pending", "active"])
      .maybeSingle<Enrollment>();
    enrollment = data;
  }

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const enrollHref = current ? `/${locale}/dashboard/enroll/${course.slug}` : `/${locale}/register?next=${encodeURIComponent(`/${locale}/dashboard/enroll/${course.slug}`)}`;

  const cta = enrollment?.status === "active" ? (
    <ButtonLink href={`/${locale}/dashboard/courses/${course.slug}`} size="lg" className="w-full">{dict.course.goToCourse}</ButtonLink>
  ) : enrollment?.status === "pending" ? (
    <ButtonLink href={`/${locale}/dashboard/enroll/${course.slug}`} size="lg" variant="secondary" className="w-full">{dict.course.pendingEnrollment}</ButtonLink>
  ) : course.enrollment_open ? (
    <ButtonLink href={enrollHref} size="lg" className="w-full">{dict.course.enrollCta}</ButtonLink>
  ) : (
    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{dict.course.enrollmentClosed}</p>
  );

  const facts: [typeof Clock, string, string][] = [
    [GraduationCap, dict.course.level, dict.levels[course.level]],
    ...(course.duration_weeks ? ([[CalendarDays, dict.course.duration, `${course.duration_weeks} ${dict.common.weeks}`]] as [typeof Clock, string, string][]) : []),
    ...(course.estimated_hours ? ([[Clock, dict.course.effort, `${course.estimated_hours} ${dict.common.hours}`]] as [typeof Clock, string, string][]) : []),
    [KeyRound, dict.course.access, fmt(dict.course.accessValue, { days: course.access_days })],
    [Languages, dict.course.language, dict.course.languagesValue],
    ...(course.certificate_enabled ? ([[Award, dict.course.certificate, dict.common.yes]] as [typeof Clock, string, string][]) : []),
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <Container className="relative grid gap-10 py-14 lg:grid-cols-3 lg:py-20">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{dict.levels[course.level]}</Badge>
              <Badge tone="info">{lessonCount} {dict.common.lessons}</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">{t.title}</h1>
            {t.subtitle ? <p className="mt-4 text-lg text-slate-300">{t.subtitle}</p> : null}
            {t.description ? <p className="mt-4 max-w-2xl leading-relaxed text-slate-400">{t.description}</p> : null}
          </div>
        </Container>
      </section>

      <Container className="grid gap-8 py-12 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {t.objectives?.length ? (
            <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Target className="size-5 text-brand-600" />{dict.course.objectives}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {t.objectives.map((o) => (
                  <li key={o} className="flex gap-2.5 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />{o}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {t.target_audience ? (
            <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Users className="size-5 text-brand-600" />{dict.course.audience}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{t.target_audience}</p>
            </section>
          ) : null}

          <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
            <h2 className="text-xl font-bold">{dict.course.curriculum}</h2>
            <div className="mt-5 space-y-3">
              {course.modules.map((m, mi) => (
                <details key={m.id} open={mi === 0} className="group rounded-xl border border-slate-200 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-semibold text-slate-900">
                      <span className="mr-2 text-brand-600">{String(mi + 1).padStart(2, "0")}</span>
                      {tr(m.title, locale)}
                    </span>
                    <span className="text-xs text-slate-500">{m.lessons.length} {dict.common.lessons}</span>
                  </summary>
                  <ul className="border-t border-slate-100 px-4 py-2">
                    {m.lessons.map((l) => {
                      const Icon = lessonIcons[l.type];
                      return (
                        <li key={l.id} className="flex items-center gap-3 py-2 text-sm text-slate-700">
                          <Icon className="size-4 shrink-0 text-slate-400" />
                          <span className="flex-1">{tr(l.title, locale)}</span>
                          {l.is_preview ? <Badge tone="info">{dict.course.preview}</Badge> : null}
                          {l.estimated_minutes ? <span className="text-xs text-slate-400">{l.estimated_minutes} min</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
              {course.hasFinalExam ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3.5 text-sm font-semibold text-brand-800">
                  <Award className="size-4" />{dict.course.finalExam}
                </div>
              ) : null}
            </div>
          </section>

          {t.certificate_requirements ? (
            <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Award className="size-5 text-gold-500" />{dict.course.requirements}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{t.certificate_requirements}</p>
              <p className="mt-3 text-xs text-slate-500">{dict.home.certificateNote}</p>
            </section>
          ) : null}
        </div>

        <aside className="lg:-mt-40">
          <div className="sticky top-24 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70">
            <div className="aspect-[16/9]"><CourseCover course={course} /></div>
            <div className="p-6">
              <p className="text-sm text-slate-500">{dict.course.price}</p>
              <p className="font-display text-3xl font-bold text-slate-900">
                {Number(course.price) > 0 ? formatMoney(course.price, course.currency, locale) : dict.common.priceOnRequest}
              </p>
              <div className="mt-5">{cta}</div>
              <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                {facts.map(([Icon, k, v]) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <Icon className="size-4 text-brand-600" />
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="ml-auto font-medium text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      </Container>
    </>
  );
}
