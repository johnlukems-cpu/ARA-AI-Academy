"use client";
import { startTransition, useActionState, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { saveSettings, setBrandingImage, savePaymentMethod, saveEmailTemplate } from "@/app/actions/settings";
import { uploadFile } from "@/components/forms/upload";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { ActionButton, BiField } from "./builder";

type L = Partial<Record<string, string>> | null | undefined;

export type SettingsValue = {
  academy_name: string; company_name: string; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; address: string | null;
  admin_notification_email: string | null; currency: string; supported_currencies: string[]; default_access_days: number; default_passing_score: number;
  enrollment_open: boolean; reminder_days: number[]; certificate_signatory_name: string | null; certificate_signatory_title: L; certificate_accent_color: string;
};

export function SettingsForm({ value }: { value: SettingsValue }) {
  const { locale, dict } = useI18n();
  const s = dict.admin.settings;
  return (
    <ActionForm action={saveSettings} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.academyName} htmlFor="academy_name" required><Input id="academy_name" name="academy_name" defaultValue={value.academy_name} required maxLength={120} /></Field>
        <Field label={s.companyName} htmlFor="company_name" required><Input id="company_name" name="company_name" defaultValue={value.company_name} required maxLength={120} /></Field>
        <Field label={s.contactEmail} htmlFor="contact_email"><Input id="contact_email" name="contact_email" type="email" defaultValue={value.contact_email ?? ""} /></Field>
        <Field label={s.adminEmail} htmlFor="admin_notification_email"><Input id="admin_notification_email" name="admin_notification_email" type="email" defaultValue={value.admin_notification_email ?? ""} /></Field>
        <Field label={s.contactPhone} htmlFor="contact_phone"><Input id="contact_phone" name="contact_phone" defaultValue={value.contact_phone ?? ""} maxLength={40} /></Field>
        <Field label={s.contactWhatsapp} htmlFor="contact_whatsapp"><Input id="contact_whatsapp" name="contact_whatsapp" defaultValue={value.contact_whatsapp ?? ""} maxLength={40} /></Field>
        <Field label={s.address} htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={value.address ?? ""} maxLength={300} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={s.currency} htmlFor="currency"><Input id="currency" name="currency" defaultValue={value.currency} maxLength={3} pattern="[A-Za-z]{3}" required /></Field>
        <Field label={s.currencies} htmlFor="supported_currencies"><Input id="supported_currencies" name="supported_currencies" defaultValue={value.supported_currencies.join(", ")} /></Field>
        <Field label={s.accessDays} htmlFor="default_access_days"><Input id="default_access_days" name="default_access_days" type="number" min={1} max={3650} defaultValue={value.default_access_days} /></Field>
        <Field label={s.passingScore} htmlFor="default_passing_score"><Input id="default_passing_score" name="default_passing_score" type="number" min={1} max={100} defaultValue={value.default_passing_score} /></Field>
        <Field label={s.reminderDays} htmlFor="reminder_days"><Input id="reminder_days" name="reminder_days" defaultValue={value.reminder_days.join(", ")} /></Field>
      </div>
      <Checkbox name="enrollment_open" label={s.enrollmentOpen} defaultChecked={value.enrollment_open} />
      <div className="space-y-4 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{s.certificate}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={s.signatoryName} htmlFor="certificate_signatory_name"><Input id="certificate_signatory_name" name="certificate_signatory_name" defaultValue={value.certificate_signatory_name ?? ""} maxLength={120} /></Field>
          <Field label={s.signatoryTitleNl} htmlFor="signatory_title_nl"><Input id="signatory_title_nl" name="signatory_title_nl" defaultValue={value.certificate_signatory_title?.nl ?? ""} maxLength={120} /></Field>
          <Field label={s.signatoryTitleEn} htmlFor="signatory_title_en"><Input id="signatory_title_en" name="signatory_title_en" defaultValue={value.certificate_signatory_title?.en ?? ""} maxLength={120} /></Field>
          <Field label={s.accentColor} htmlFor="certificate_accent_color"><Input id="certificate_accent_color" name="certificate_accent_color" type="color" defaultValue={value.certificate_accent_color} className="h-11 p-1" /></Field>
        </div>
      </div>
      <SubmitButton>{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function BrandingImage({ target, label, url, accept }: { target: "logo_url" | "certificate_signature_url"; label: string; url: string | null; accept: string }) {
  const { locale, dict } = useI18n();
  const [state, dispatch, pending] = useActionState(setBrandingImage, null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const up = await uploadFile(file, "public-assets", locale, "branding");
      const fd = new FormData();
      fd.set("locale", locale);
      fd.set("target", target);
      fd.set("storage_path", up.storage_path);
      startTransition(() => dispatch(fd));
    } catch (x) {
      setErr(x instanceof Error ? x.message : dict.errors.uploadFailed);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-20 max-w-full rounded-lg bg-slate-50 object-contain p-2 ring-1 ring-slate-200" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <label className={buttonClass("secondary", "sm", "cursor-pointer")}>
          {busy || pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{dict.common.add}
          <input type="file" accept={accept} className="sr-only" onChange={onChange} disabled={busy || pending} />
        </label>
        {url ? <ActionButton action={setBrandingImage} fields={{ target, storage_path: "" }} variant="ghost">{dict.common.delete}</ActionButton> : null}
      </div>
      {err ? <Alert tone="error">{err}</Alert> : null}
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
    </div>
  );
}

export type MethodValue = { id?: string; code: string; kind: string; name: L; instructions: L; requires_proof: boolean; requires_reference: boolean; is_active: boolean; sort_order: number };

export function PaymentMethodForm({ value }: { value?: MethodValue }) {
  const { locale, dict } = useI18n();
  const s = dict.admin.settings;
  return (
    <ActionForm action={savePaymentMethod} className="space-y-4" resetOnSuccess={!value}>
      <input type="hidden" name="locale" value={locale} />
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={s.code} htmlFor={`pm-code-${value?.id ?? "new"}`} required><Input id={`pm-code-${value?.id ?? "new"}`} name="code" defaultValue={value?.code ?? ""} pattern="[a-z0-9_\-]+" required maxLength={40} /></Field>
        <Field label={s.methodKind} htmlFor={`pm-kind-${value?.id ?? "new"}`}>
          <Select id={`pm-kind-${value?.id ?? "new"}`} name="kind" defaultValue={value?.kind ?? "bank_transfer"}>
            {(Object.keys(s.methodKinds) as (keyof typeof s.methodKinds)[]).map((k) => <option key={k} value={k}>{s.methodKinds[k]}</option>)}
          </Select>
        </Field>
        <Field label={dict.admin.courses.sortOrder} htmlFor={`pm-sort-${value?.id ?? "new"}`}><Input id={`pm-sort-${value?.id ?? "new"}`} name="sort_order" type="number" min={0} defaultValue={value?.sort_order ?? 0} /></Field>
      </div>
      <BiField name="name" label={s.methodName} value={value?.name} required maxLength={100} />
      <BiField name="instructions" label={s.methodInstructions} value={value?.instructions} multiline rows={5} maxLength={5000} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="is_active" label={s.active} defaultChecked={value?.is_active ?? true} />
        <Checkbox name="requires_proof" label={s.requiresProof} defaultChecked={value?.requires_proof ?? true} />
        <Checkbox name="requires_reference" label={s.requiresReference} defaultChecked={value?.requires_reference ?? true} />
      </div>
      <SubmitButton size="sm">{value ? dict.common.save : s.addMethod}</SubmitButton>
    </ActionForm>
  );
}

export function EmailTemplateForm({ templateKey, templateLocale, vars, custom, defaults }: {
  templateKey: string; templateLocale: string; vars: string[]; custom: { subject: string; body: string } | null; defaults: { subject: string; body: string };
}) {
  const { locale, dict } = useI18n();
  const s = dict.admin.settings;
  return (
    <ActionForm action={saveEmailTemplate} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="key" value={templateKey} />
      <input type="hidden" name="template_locale" value={templateLocale} />
      <Field label={s.subject} htmlFor={`sub-${templateKey}-${templateLocale}`}>
        <Input id={`sub-${templateKey}-${templateLocale}`} name="subject" defaultValue={custom?.subject ?? ""} placeholder={defaults.subject} maxLength={200} />
      </Field>
      <Field label={s.body} htmlFor={`body-${templateKey}-${templateLocale}`} hint={fmt(s.templateHint, { vars: vars.map((v) => `{{${v}}}`).join(", ") })}>
        <Textarea id={`body-${templateKey}-${templateLocale}`} name="body" rows={8} defaultValue={custom?.body ?? ""} placeholder={defaults.body} className="font-mono text-xs" maxLength={10000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm">{dict.common.save}</SubmitButton>
        {custom ? <SubmitButton size="sm" variant="ghost" name="reset" value="1">{s.resetTemplate}</SubmitButton> : null}
      </div>
    </ActionForm>
  );
}
