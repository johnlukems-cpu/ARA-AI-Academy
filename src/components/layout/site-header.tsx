import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const current = await getCurrentUser();
  const links = [
    { href: `/${locale}/courses`, label: dict.nav.courses },
    { href: `/${locale}/how-it-works`, label: dict.nav.howItWorks },
    { href: `/${locale}/pricing`, label: dict.nav.pricing },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/faq`, label: dict.nav.faq },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];
  const portalHref = current?.profile.role === "admin" ? `/${locale}/admin` : `/${locale}/dashboard`;
  const authButtons = current ? (
    <ButtonLink href={portalHref} size="sm">{current.profile.role === "admin" ? dict.nav.admin : dict.nav.dashboard}</ButtonLink>
  ) : (
    <>
      <ButtonLink href={`/${locale}/login`} variant="ghost" size="sm">{dict.nav.login}</ButtonLink>
      <ButtonLink href={`/${locale}/register`} size="sm">{dict.nav.register}</ButtonLink>
    </>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} aria-label={dict.nav.home} className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <div className="hidden items-center gap-1.5 sm:flex">{authButtons}</div>
          <MobileMenu links={links} label={dict.nav.menu} footer={<div className="flex gap-2 sm:hidden">{authButtons}</div>} />
        </div>
      </div>
    </header>
  );
}
