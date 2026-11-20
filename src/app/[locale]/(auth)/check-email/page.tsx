import Link from "next/link";
import { notFound } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";

export default async function CheckEmailPage({ params, searchParams }: PageProps<"/[locale]/check-email">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { email } = await searchParams;
  const dict = getDictionary(locale);
  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600"><MailCheck className="size-8" /></span>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">{dict.auth.checkEmailTitle}</h1>
      <p className="mt-3 text-slate-600">{fmt(dict.auth.checkEmailText, { email: typeof email === "string" ? email : "" })}</p>
      <p className="mt-4 text-sm text-slate-500">{dict.auth.checkEmailHint}</p>
      <Link href={`/${locale}/login`} className="mt-8 inline-block text-sm font-semibold text-brand-600">{dict.nav.login} →</Link>
    </div>
  );
}
