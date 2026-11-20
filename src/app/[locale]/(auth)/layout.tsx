import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute -left-20 top-1/3 size-96 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <Link href={`/${locale}`} className="relative"><Logo dark /></Link>
        <div className="relative">
          <p className="text-gradient font-display text-4xl font-extrabold leading-tight">{dict.meta.tagline}</p>
          <ul className="mt-8 space-y-3 text-slate-300">
            {dict.home.heroPoints.map((p) => (
              <li key={p} className="flex items-center gap-2.5"><CheckCircle2 className="size-5 text-accent-400" />{p}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">{dict.home.certificateNote}</p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link href={`/${locale}`} className="lg:invisible"><Logo /></Link>
          <Suspense><LanguageSwitcher /></Suspense>
        </div>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
