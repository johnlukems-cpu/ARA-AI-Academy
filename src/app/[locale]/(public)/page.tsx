import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Rocket, Clock3, Languages, MapPin, QrCode, Award, PlayCircle, FileText, ListChecks, MessageSquareQuote } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getPublishedCourses } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { LogoMark } from "@/components/ui/logo";
import { Container, FaqList, SectionHeading } from "@/components/public/section";
import { CourseCard } from "@/components/public/course-card";

const whyIcons = [Rocket, Clock3, Languages, MapPin];

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const h = dict.home;
  const courses = await getPublishedCourses();
  const featured = (courses.filter((c) => c.is_featured).length ? courses.filter((c) => c.is_featured) : courses).slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute -left-40 top-10 size-[28rem] rounded-full bg-brand-600/35 blur-3xl" aria-hidden />
        <div className="absolute -right-32 bottom-0 size-[24rem] rounded-full bg-accent-500/20 blur-3xl" aria-hidden />
        <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-300 ring-1 ring-white/10">
              <span className="size-1.5 rounded-full bg-accent-400" />
              {h.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              <span className="text-gradient">{h.heroTitle}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-slate-300 sm:text-lg">{h.heroText}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={`/${locale}/register`} size="lg" variant="light">
                {dict.common.startLearning}
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href={`/${locale}/courses`} size="lg" variant="outline-light">
                {dict.common.exploreCourses}
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {h.heroPoints.map((p) => (
                <li key={p} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-accent-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
            <div className="rounded-3xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
              <div className="rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <LogoMark className="size-8" />
                  <div className="flex-1">
                    <div className="h-2.5 w-32 rounded bg-slate-200" />
                    <div className="mt-1.5 h-2 w-20 rounded bg-slate-100" />
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">67 {dict.common.days}</span>
                </div>
                <div className="mt-5 rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 p-4 text-white">
                  <p className="text-xs font-medium opacity-80">AI Fundamentals</p>
                  <p className="mt-1 font-display text-lg font-bold">{dict.portal.continue}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/25">
                    <div className="h-full w-2/3 rounded-full bg-white" />
                  </div>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    [PlayCircle, dict.lessonTypes.video, true],
                    [FileText, dict.lessonTypes.pdf, true],
                    [ListChecks, dict.lessonTypes.quiz, false],
                  ].map(([Icon, label, done], i) => {
                    const I = Icon as typeof PlayCircle;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                        <I className="size-4 text-brand-600" />
                        <span className="flex-1 text-sm text-slate-700">{label as string}</span>
                        {done ? <CheckCircle2 className="size-4 text-emerald-500" /> : <span className="size-4 rounded-full border-2 border-slate-200" />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <ProgressBar value={67} />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl sm:flex">
              <span className="grid size-9 place-items-center rounded-xl bg-gold-400/20 text-gold-500"><Award className="size-5" /></span>
              <div>
                <p className="text-xs text-slate-500">{dict.certificates.code}</p>
                <p className="font-mono text-xs font-semibold text-slate-800">ARA-2026-7KQ4M2XD</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured courses */}
      <section className="py-16 sm:py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading title={h.featuredTitle} text={h.featuredText} />
            <ButtonLink href={`/${locale}/courses`} variant="secondary">
              {dict.common.exploreCourses}
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
          {featured.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => (
                <CourseCard key={c.id} course={c} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
              {isSupabaseConfigured() ? h.noCourses : dict.common.notConfigured}
            </p>
          )}
        </Container>
      </section>

      {/* Why */}
      <section className="bg-white py-16 sm:py-24">
        <Container>
          <SectionHeading title={h.whyTitle} center />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {h.why.map((w, i) => {
              const Icon = whyIcons[i % whyIcons.length];
              return (
                <div key={w.title} className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><Icon className="size-5" /></span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{w.text}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Process */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading title={h.processTitle} center />
          <ol className="relative mt-12 grid gap-6 md:grid-cols-4">
            {h.process.map((step, i) => (
              <li key={step.title} className="relative rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
                <span className="font-display text-4xl font-extrabold text-brand-100">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Journey */}
      <section className="relative overflow-hidden bg-ink py-16 sm:py-24">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <Container className="relative">
          <SectionHeading title={h.journeyTitle} text={h.journeyText} dark />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {h.journey.map((m, i) => (
              <div key={m.title} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 font-display font-bold text-white">{i + 1}</span>
                  <h3 className="text-lg font-bold text-white">{m.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{m.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Certificate */}
      <section className="bg-white py-16 sm:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title={h.certificateTitle} text={h.certificateText} />
            <p className="mt-4 text-sm text-slate-500">{h.certificateNote}</p>
            <ButtonLink href={`/${locale}/verify`} variant="secondary" className="mt-6">
              <QrCode className="size-4" />
              {dict.nav.verify}
            </ButtonLink>
          </div>
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-50 to-cyan-50 p-6 sm:p-10" aria-hidden>
            <div className="rounded-2xl border-4 border-double border-brand-200 bg-white p-6 text-center shadow-xl sm:p-8">
              <LogoMark className="mx-auto size-10" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-600">{dict.certificates.pdfTitle}</p>
              <p className="mt-4 text-xs text-slate-500">{dict.certificates.pdfPresented}</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900">Jane Doe</p>
              <div className="mx-auto mt-2 h-px w-40 bg-slate-200" />
              <p className="mt-3 text-xs text-slate-500">{dict.certificates.pdfCompleted}</p>
              <p className="mt-1 font-semibold text-slate-800">AI Fundamentals</p>
              <div className="mt-6 flex items-end justify-between text-left">
                <div>
                  <div className="h-px w-24 bg-slate-300" />
                  <p className="mt-1 text-[10px] text-slate-500">ARA AI Academy</p>
                </div>
                <QrCode className="size-12 text-slate-700" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading title={h.benefitsTitle} center />
          <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            {h.benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3.5 shadow-card ring-1 ring-slate-200/70">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">{b}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Testimonials – only real testimonials will be shown */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionHeading title={h.testimonialsTitle} center />
          <div className="mx-auto mt-8 flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
            <MessageSquareQuote className="size-8 text-brand-400" />
            <p className="mt-3 text-sm text-slate-600">{h.testimonialsEmpty}</p>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <Container className="max-w-3xl">
          <SectionHeading title={h.faqTitle} center />
          <div className="mt-10">
            <FaqList items={dict.faq.items.slice(0, 5)} />
          </div>
          <p className="mt-6 text-center">
            <a href={`/${locale}/faq`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">{dict.common.learnMore} →</a>
          </p>
        </Container>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-6 py-14 text-center shadow-glow sm:px-12">
          <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{h.ctaTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-50">{h.ctaText}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={`/${locale}/register`} size="lg" variant="light">{dict.common.startLearning}</ButtonLink>
              <ButtonLink href={`/${locale}/courses`} size="lg" variant="outline-light">{dict.common.exploreCourses}</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
