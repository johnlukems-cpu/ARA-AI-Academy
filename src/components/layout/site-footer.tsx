import Link from "next/link";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { getSettings } from "@/lib/data/catalog";
import { Logo } from "@/components/ui/logo";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const year = new Date().getFullYear();
  const col = (title: string, links: [string, string][]) => (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-slate-400 transition-colors hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="bg-ink text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo dark name={settings.academy_name} />
          <p className="mt-4 max-w-sm text-sm text-slate-400">{dict.meta.tagline}</p>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{settings.company_name}</p>
        </div>
        {col(dict.nav.courses, [
          [`/${locale}/courses`, dict.catalog.title],
          [`/${locale}/how-it-works`, dict.nav.howItWorks],
          [`/${locale}/pricing`, dict.nav.pricing],
          [`/${locale}/verify`, dict.nav.verify],
        ])}
        {col(dict.nav.about, [
          [`/${locale}/about`, dict.nav.about],
          [`/${locale}/faq`, dict.nav.faq],
          [`/${locale}/contact`, dict.nav.contact],
        ])}
        {col(dict.contact.details, [
          [`/${locale}/terms`, dict.nav.terms],
          [`/${locale}/privacy`, dict.nav.privacy],
          ...(settings.contact_email ? ([[`mailto:${settings.contact_email}`, settings.contact_email]] as [string, string][]) : []),
        ])}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>© {year} {settings.company_name}. {settings.academy_name}.</p>
          <p>{dict.home.certificateNote}</p>
        </div>
      </div>
    </footer>
  );
}
