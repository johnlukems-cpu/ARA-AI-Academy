import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalShell, type NavItem } from "@/components/layout/portal-shell";

export const metadata = { robots: { index: false } };

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const n = dict.admin.nav;
  const { profile } = await requireAdmin(locale);
  const supabase = await createClient();
  const [{ count: pendingPayments }, { count: toReview }, { count: newMessages }] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).is("handled_at", null),
  ]);
  const base = `/${locale}/admin`;
  const items: NavItem[] = [
    { href: base, label: n.dashboard, icon: "dashboard", exact: true },
    { href: `${base}/payments`, label: n.payments, icon: "wallet", badge: pendingPayments || undefined },
    { href: `${base}/students`, label: n.students, icon: "students" },
    { href: `${base}/enrollments`, label: n.enrollments, icon: "enrollments" },
    { href: `${base}/courses`, label: n.courses, icon: "courses" },
    { href: `${base}/submissions`, label: n.submissions, icon: "submissions", badge: toReview || undefined },
    { href: `${base}/certificates`, label: n.certificates, icon: "certificates" },
    { href: `${base}/reports`, label: n.reports, icon: "reports" },
    { href: `${base}/messages`, label: n.messages, icon: "messages", badge: newMessages || undefined },
    { href: `${base}/settings`, label: n.settings, icon: "settings" },
    { href: `${base}/audit`, label: n.audit, icon: "audit" },
  ];
  const secondary: NavItem[] = [
    { href: `/${locale}/dashboard`, label: n.studentView, icon: "learning" },
    { href: `/${locale}`, label: n.backToSite, icon: "site", exact: true },
  ];
  return (
    <PortalShell
      items={items}
      secondary={secondary}
      user={{ name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email, email: profile.email, avatar: profile.avatar_url }}
      homeHref={base}
      logoutLabel={dict.nav.logout}
      locale={locale}
      areaLabel={dict.admin.title}
    >
      {children}
    </PortalShell>
  );
}
