import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, locales } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tr, type Localized } from "@/lib/localize";
import { defaultTemplates, templateKeys, templateVariables } from "@/lib/email/templates";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { SettingsForm, BrandingImage, PaymentMethodForm, EmailTemplateForm, type SettingsValue, type MethodValue } from "@/components/admin/settings-forms";

const tabs = ["general", "payments", "emails"] as const;

export default async function AdminSettings({ params, searchParams }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const s = dict.admin.settings;
  const sp = await searchParams;
  const tab = (tabs as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof tabs)[number]) : "general";
  const base = `/${locale}/admin/settings`;
  const labels = { general: s.general, payments: s.paymentMethods, emails: s.emailTemplates };

  let body: React.ReactNode = null;
  if (tab === "general") {
    // Service client: admin_notification_email is not readable through the public column grant.
    const { data } = await createAdminClient().from("academy_settings").select("*").eq("id", 1).maybeSingle();
    const v = data as (SettingsValue & { logo_url: string | null; certificate_signature_url: string | null }) | null;
    body = v ? (
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader title={s.general} /><CardBody><SettingsForm value={v} /></CardBody></Card>
        <Card>
          <CardHeader title={s.logo} />
          <CardBody className="space-y-6">
            <BrandingImage target="logo_url" label={s.logo} url={v.logo_url} accept="image/png,image/jpeg,image/webp,image/svg+xml" />
            <BrandingImage target="certificate_signature_url" label={s.signature} url={v.certificate_signature_url} accept="image/png,image/jpeg" />
          </CardBody>
        </Card>
      </div>
    ) : null;
  } else if (tab === "payments") {
    const supabase = await createClient();
    const { data } = await supabase.from("payment_methods").select("*").order("sort_order");
    const methods = (data ?? []) as (MethodValue & { id: string })[];
    body = (
      <div className="space-y-4">
        {methods.map((m) => (
          <details key={m.id} className="rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4">
              <span className="font-semibold text-slate-900">{tr(m.name as Localized, locale)} <span className="ml-2 font-mono text-xs text-slate-400">{m.code}</span></span>
              <Badge tone={m.is_active ? "success" : "neutral"}>{m.is_active ? s.active : dict.common.no}</Badge>
            </summary>
            <div className="border-t border-slate-100 p-5"><PaymentMethodForm value={m} /></div>
          </details>
        ))}
        <Card><CardHeader title={s.addMethod} /><CardBody><PaymentMethodForm /></CardBody></Card>
      </div>
    );
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("email_templates").select("key, locale, subject, body");
    const custom = new Map((data ?? []).map((t) => [`${t.key}:${t.locale}`, t as { subject: string; body: string }]));
    body = (
      <div className="space-y-4">
        {templateKeys.map((key) => (
          <details key={key} className="rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4">
              <span className="font-mono text-sm font-semibold text-slate-900">{key}</span>
              <span className="flex gap-1.5">
                {locales.map((l) => <Badge key={l} tone={custom.has(`${key}:${l}`) ? "brand" : "neutral"}>{l.toUpperCase()} · {custom.has(`${key}:${l}`) ? s.customized : s.usingDefault}</Badge>)}
              </span>
            </summary>
            <div className="grid gap-6 border-t border-slate-100 p-5 lg:grid-cols-2">
              {locales.map((l) => (
                <div key={l}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{l === "nl" ? dict.admin.courses.dutch : dict.admin.courses.english}</p>
                  <EmailTemplateForm templateKey={key} templateLocale={l} vars={templateVariables[key]} custom={custom.get(`${key}:${l}`) ?? null} defaults={defaultTemplates[key][l]} />
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title={s.title} />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t} href={`${base}?tab=${t}`} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium ring-1", tab === t ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>{labels[t]}</Link>
        ))}
      </div>
      {body}
    </>
  );
}
