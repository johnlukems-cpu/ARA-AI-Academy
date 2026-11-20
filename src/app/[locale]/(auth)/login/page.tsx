import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).nav.login } : {};
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { next, error } = await searchParams;
  const dict = getDictionary(locale);
  const current = await getCurrentUser();
  if (current && current.profile.status === "active") redirect(current.profile.role === "admin" ? `/${locale}/admin` : `/${locale}/dashboard`);
  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">{dict.auth.loginTitle}</h1>
      <p className="mt-2 text-slate-600">{dict.auth.loginText}</p>
      <div className="mt-8 space-y-4">
        {!isSupabaseConfigured() ? <Alert tone="warning">{dict.common.notConfigured}</Alert> : null}
        {error === "link" ? <Alert tone="error">{dict.auth.linkInvalid}</Alert> : null}
        {error === "suspended" ? <Alert tone="error">{dict.auth.suspended}</Alert> : null}
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
      <p className="mt-8 text-center text-sm text-slate-600">
        {dict.auth.noAccount}{" "}
        <Link href={`/${locale}/register${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:text-brand-700">{dict.nav.register}</Link>
      </p>
    </>
  );
}
