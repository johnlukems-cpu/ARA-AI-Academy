import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data/student";
import { PortalShell, type NavItem } from "@/components/layout/portal-shell";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { user, profile } = await requireUser(locale, `/${locale}/dashboard`);
  const unread = await getUnreadCount(user.id);
  const base = `/${locale}/dashboard`;
  const items: NavItem[] = [
    { href: base, label: dict.portal.overview, icon: "dashboard", exact: true },
    { href: `${base}/courses`, label: dict.portal.myLearning, icon: "learning" },
    { href: `${base}/browse`, label: dict.portal.browse, icon: "browse" },
    { href: `${base}/payments`, label: dict.portal.payments, icon: "payments" },
    { href: `${base}/certificates`, label: dict.portal.certificates, icon: "certificates" },
    { href: `${base}/notifications`, label: dict.portal.notifications, icon: "notifications", badge: unread || undefined },
    { href: `${base}/profile`, label: dict.portal.profile, icon: "profile" },
  ];
  const secondary: NavItem[] = [
    ...(profile.role === "admin" ? [{ href: `/${locale}/admin`, label: dict.nav.admin, icon: "settings" as const }] : []),
    { href: `/${locale}`, label: dict.admin.nav.backToSite, icon: "site", exact: true },
  ];
  return (
    <PortalShell
      items={items}
      secondary={secondary}
      user={{ name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email, email: profile.email, avatar: profile.avatar_url }}
      homeHref={base}
      logoutLabel={dict.nav.logout}
      locale={locale}
    >
      {children}
    </PortalShell>
  );
}
