import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Building } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { courseText, getActivePaymentMethods, getPublishedCourses, getSettings } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/format";
import { tr } from "@/lib/localize";
import { Container, PageHero } from "@/components/public/section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).pricing.title } : {};
}

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const p = dict.pricing;
  const [courses, methods, settings] = await Promise.all([getPublishedCourses(), getActivePaymentMethods(), getSettings()]);
  return (
    <>
      <PageHero title={p.title} text={fmt(p.intro, { currency: settings.currency })} />
      <Container className="grid gap-8 py-16 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {courses.length > 0 ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
              {courses.map((c) => {
                const t = courseText(c, locale);
                return (
                  <Link key={c.id} href={`/${locale}/courses/${c.slug}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 sm:px-6">
                    <div>
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      <div className="mt-1 flex gap-2"><Badge tone="brand">{dict.levels[c.level]}</Badge><Badge>{c.access_days} {dict.common.days}</Badge></div>
                    </div>
                    <p className="text-right">
                      <span className="font-display text-xl font-bold">{Number(c.price) > 0 ? formatMoney(c.price, c.currency, locale) : dict.common.priceOnRequest}</span>
                      <span className="block text-xs text-slate-500">{p.perCourse}</span>
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">{dict.catalog.empty}</p>
          )}
          <h2 className="mt-12 text-2xl font-bold">{p.methodsTitle}</h2>
          <p className="mt-2 text-slate-600">{p.methodsText}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {methods.map((m) => (
              <div key={m.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
                <p className="font-semibold">{tr(m.name, locale)}</p>
                <div className="prose-lesson mt-2 text-sm"><ReactMarkdown>{tr(m.instructions, locale, "").split("\n\n")[0]}</ReactMarkdown></div>
              </div>
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl bg-ink p-6 text-slate-300">
            <h2 className="font-bold text-white">{p.includes}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {p.includesList.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-400" />{x}</li>)}
            </ul>
            <ButtonLink href={`/${locale}/register`} variant="light" className="mt-6 w-full">{dict.common.startLearning}</ButtonLink>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
            <Building className="size-6 text-brand-600" />
            <h2 className="mt-3 font-bold">{p.businessTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{p.businessText}</p>
            <ButtonLink href={`/${locale}/contact`} variant="secondary" className="mt-4">{dict.nav.contact}</ButtonLink>
          </div>
        </aside>
      </Container>
    </>
  );
}
