import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { Container, PageHero } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/[locale]/how-it-works">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).howItWorks.title } : {};
}

export default async function HowItWorksPage({ params }: PageProps<"/[locale]/how-it-works">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const h = dict.howItWorks;
  return (
    <>
      <PageHero title={h.title} text={h.intro} />
      <Container className="py-16">
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {h.steps.map((s) => (
            <li key={s.title} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
              <h2 className="text-lg font-bold text-slate-900">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-100">
          <h2 className="flex items-center gap-2 font-bold text-brand-900"><Info className="size-5" />{h.noteTitle}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm text-brand-900/80">
            {h.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/${locale}/register`} size="lg">{dict.common.startLearning}</ButtonLink>
          <ButtonLink href={`/${locale}/courses`} size="lg" variant="secondary">{dict.common.exploreCourses}</ButtonLink>
        </div>
      </Container>
    </>
  );
}
