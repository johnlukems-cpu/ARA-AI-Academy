import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Target, Building2 } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { Container, PageHero } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).about.title } : {};
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const a = dict.about;
  return (
    <>
      <PageHero title={a.title} text={a.intro} />
      <Container className="grid gap-8 py-16 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-7 shadow-card ring-1 ring-slate-200/70 lg:col-span-2">
          <Target className="size-7 text-brand-600" />
          <h2 className="mt-4 text-2xl font-bold">{a.missionTitle}</h2>
          <p className="mt-3 leading-relaxed text-slate-600">{a.mission}</p>
          <h2 className="mt-10 text-2xl font-bold">{a.approachTitle}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {a.approach.map((x) => (
              <li key={x} className="flex gap-2.5 text-slate-700"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-ink p-7 text-slate-300">
          <Building2 className="size-7 text-accent-300" />
          <h2 className="mt-4 text-xl font-bold text-white">{a.companyTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed">{a.company}</p>
          <ButtonLink href={`/${locale}/contact`} variant="light" className="mt-6">{dict.nav.contact}</ButtonLink>
        </div>
      </Container>
    </>
  );
}
