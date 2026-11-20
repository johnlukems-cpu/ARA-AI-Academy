import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/forms/auth-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).nav.register } : {};
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { next } = await searchParams;
  const dict = getDictionary(locale);
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">{dict.auth.registerTitle}</h1>
      <p className="mt-2 text-slate-600">{dict.auth.registerText}</p>
      <div className="mt-8"><RegisterForm next={typeof next === "string" ? next : undefined} /></div>
      <p className="mt-8 text-center text-sm text-slate-600">
        {dict.auth.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-brand-600 hover:text-brand-700">{dict.nav.login}</Link>
      </p>
    </>
  );
}
