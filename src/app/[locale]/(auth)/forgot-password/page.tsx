import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { ForgotForm } from "@/components/forms/auth-forms";

export default async function ForgotPage({ params }: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">{dict.auth.forgotTitle}</h1>
      <p className="mt-2 text-slate-600">{dict.auth.forgotText}</p>
      <div className="mt-8"><ForgotForm /></div>
      <p className="mt-8 text-center text-sm"><Link href={`/${locale}/login`} className="font-semibold text-brand-600">← {dict.nav.login}</Link></p>
    </>
  );
}
