import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { sendTemplate } from "@/lib/email/send";
import type { TemplateKey } from "@/lib/email/templates";
import { formatDate, formatMoney } from "@/lib/format";
import { isLocale, type Locale } from "@/i18n/config";

type Vars = Record<string, string | number | null | undefined>;

async function courseInfo(courseId: string, locale: Locale) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("courses")
    .select("slug, price, currency, course_translations(locale, title)")
    .eq("id", courseId)
    .maybeSingle();
  const translations = (data?.course_translations ?? []) as { locale: string; title: string }[];
  const title =
    translations.find((t) => t.locale === locale)?.title ?? translations[0]?.title ?? "";
  return { slug: data?.slug ?? "", title, price: data?.price ?? 0, currency: data?.currency ?? "SRD" };
}

/**
 * Email a student using their preferred language. Common variables are filled in
 * automatically: name, course, course_url, payment_url, amount, contact_url.
 */
export async function emailStudent(studentId: string, key: TemplateKey, opts: { courseId?: string; vars?: Vars; expiresAt?: string | null } = {}) {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email, first_name, last_name, preferred_locale")
      .eq("id", studentId)
      .maybeSingle();
    if (!profile?.email) return;
    const locale: Locale = isLocale(profile.preferred_locale) ? profile.preferred_locale : "nl";
    const base = `${publicEnv.siteUrl}/${locale}`;
    const vars: Vars = {
      name: profile.first_name || profile.email,
      dashboard_url: `${base}/dashboard`,
      courses_url: `${base}/courses`,
      contact_url: `${base}/contact`,
    };
    if (opts.courseId) {
      const c = await courseInfo(opts.courseId, locale);
      vars.course = c.title;
      vars.course_url = `${base}/dashboard/courses/${c.slug}`;
      vars.payment_url = `${base}/dashboard/enroll/${c.slug}`;
      vars.amount = formatMoney(c.price, c.currency, locale);
    }
    if (opts.expiresAt) vars.expires = formatDate(opts.expiresAt, locale);
    await sendTemplate({ key, to: profile.email, locale, vars: { ...vars, ...opts.vars }, userId: studentId });
  } catch (e) {
    console.error(`emailStudent(${key}) failed`, e);
  }
}

/** Email the administrators (settings address, env fallback, or all admin accounts). */
export async function emailAdmins(key: TemplateKey, vars: Vars) {
  try {
    const admin = createAdminClient();
    const { data: settings } = await admin.from("academy_settings").select("admin_notification_email").eq("id", 1).maybeSingle();
    let recipients: string[] = [];
    const configured = settings?.admin_notification_email || process.env.ADMIN_NOTIFICATION_EMAIL;
    if (configured) recipients = configured.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (recipients.length === 0) {
      const { data: admins } = await admin.from("profiles").select("email").eq("role", "admin").eq("status", "active");
      recipients = (admins ?? []).map((a: { email: string }) => a.email).filter(Boolean);
    }
    await Promise.all(recipients.map((to) => sendTemplate({ key, to, locale: "nl", vars })));
  } catch (e) {
    console.error(`emailAdmins(${key}) failed`, e);
  }
}

export function adminUrl(path: string) {
  return `${publicEnv.siteUrl}/nl/admin${path}`;
}

export function moneyFor(amount: number | string, currency: string, locale: Locale = "nl") {
  return formatMoney(amount, currency, locale);
}
