import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { Container, PageHero } from "@/components/public/section";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { VerifyResult } from "@/components/public/verify-result";

export async function generateMetadata({ params }: PageProps<"/[locale]/verify">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).verify.title } : {};
}

export default async function VerifyPage({ params, searchParams }: PageProps<"/[locale]/verify">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { code } = await searchParams;
  const dict = getDictionary(locale);
  const value = typeof code === "string" ? code.trim() : "";
  return (
    <>
      <PageHero title={dict.verify.title} text={dict.verify.intro} />
      <Container className="max-w-2xl py-12">
        <form method="get" className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 sm:flex-row">
          <label htmlFor="code" className="sr-only">{dict.verify.codeLabel}</label>
          <Input id="code" name="code" defaultValue={value} placeholder={dict.verify.codePlaceholder} required maxLength={40} className="font-mono uppercase" autoComplete="off" />
          <Button type="submit">{dict.verify.button}</Button>
        </form>
        {value ? <div className="mt-6"><VerifyResult code={value} locale={locale} /></div> : null}
      </Container>
    </>
  );
}
