import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { Container, PageHero } from "@/components/public/section";
import { VerifyResult } from "@/components/public/verify-result";

export async function generateMetadata({ params }: PageProps<"/[locale]/verify/[code]">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).verify.title, robots: { index: false } } : {};
}

export default async function VerifyCodePage({ params }: PageProps<"/[locale]/verify/[code]">) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <>
      <PageHero title={dict.verify.title} />
      <Container className="max-w-2xl py-12">
        <VerifyResult code={decodeURIComponent(code)} locale={locale} />
      </Container>
    </>
  );
}
