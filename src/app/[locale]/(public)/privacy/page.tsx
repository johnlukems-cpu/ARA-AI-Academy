import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { privacy } from "@/content/legal";
import { Container, PageHero } from "@/components/public/section";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: privacy[locale].title } : {};
}

export default async function LegalPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const doc = privacy[locale];
  return (
    <>
      <PageHero title={doc.title} text={doc.updated} />
      <Container className="max-w-3xl py-14">
        <article className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-10">
          <p className="leading-relaxed text-slate-700">{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.h} className="mt-8">
              <h2 className="text-lg font-bold text-slate-900">{s.h}</h2>
              {s.p.map((p, i) => <p key={i} className="mt-2 leading-relaxed text-slate-600">{p}</p>)}
            </section>
          ))}
        </article>
      </Container>
    </>
  );
}
