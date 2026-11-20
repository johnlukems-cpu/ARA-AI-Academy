"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActionAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getObjectInfo, publicUrl } from "@/lib/storage";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { templateKeys, type TemplateKey } from "@/lib/email/templates";
import { getDictionary } from "@/i18n";
import { isLocale, locales, type Locale } from "@/i18n/config";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");
const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max);
const bool = (fd: FormData, k: string) => fd.get(k) === "on";

async function guard(fd: FormData) {
  const locale = loc(fd.get("locale"));
  const dict = getDictionary(locale);
  const admin = await getActionAdmin();
  return { locale, dict, admin };
}

function refresh(locale: Locale) {
  revalidatePath(`/${locale}`, "layout");
}

const emailOrEmpty = z.union([z.email().max(200), z.literal("")]);

export async function saveSettings(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(fd);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const currencies = str(fd, "supported_currencies", 200).toUpperCase().split(/[\s,]+/).filter(Boolean);
  const reminders = str(fd, "reminder_days", 200).split(/[\s,]+/).filter(Boolean).map(Number);
  const schema = z.object({
    academy_name: z.string().min(1).max(120),
    company_name: z.string().min(1).max(120),
    contact_email: emailOrEmpty,
    contact_phone: z.string().max(40),
    contact_whatsapp: z.string().max(40),
    address: z.string().max(300),
    admin_notification_email: emailOrEmpty,
    currency: z.string().regex(/^[A-Z]{3}$/),
    supported_currencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(10),
    default_access_days: z.coerce.number().int().min(1).max(3650),
    default_passing_score: z.coerce.number().int().min(1).max(100),
    reminder_days: z.array(z.number().int().min(1).max(365)).max(10),
    certificate_signatory_name: z.string().max(120),
    certificate_accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  });
  const parsed = schema.safeParse({
    academy_name: str(fd, "academy_name", 120),
    company_name: str(fd, "company_name", 120),
    contact_email: str(fd, "contact_email", 200),
    contact_phone: str(fd, "contact_phone", 40),
    contact_whatsapp: str(fd, "contact_whatsapp", 40),
    address: str(fd, "address", 300),
    admin_notification_email: str(fd, "admin_notification_email", 200),
    currency: str(fd, "currency", 3).toUpperCase(),
    supported_currencies: currencies,
    default_access_days: str(fd, "default_access_days"),
    default_passing_score: str(fd, "default_passing_score"),
    reminder_days: reminders,
    certificate_signatory_name: str(fd, "certificate_signatory_name", 120),
    certificate_accent_color: str(fd, "certificate_accent_color", 7) || "#4F46E5",
  });
  if (!parsed.success) {
    return { ok: false, error: dict.errors.validation, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), dict.errors.validation])) };
  }
  const v = parsed.data;
  if (!v.supported_currencies.includes(v.currency)) v.supported_currencies.unshift(v.currency);
  const supabase = await createClient();
  const { error } = await supabase
    .from("academy_settings")
    .update({
      ...v,
      contact_email: v.contact_email || null,
      contact_phone: v.contact_phone || null,
      contact_whatsapp: v.contact_whatsapp || null,
      address: v.address || null,
      admin_notification_email: v.admin_notification_email || null,
      certificate_signatory_name: v.certificate_signatory_name || null,
      certificate_signatory_title: Object.fromEntries(locales.map((l) => [l, str(fd, `signatory_title_${l}`, 120)])),
      reminder_days: [...new Set(v.reminder_days)].sort((a, b) => b - a),
      enrollment_open: bool(fd, "enrollment_open"),
      updated_by: admin.user.id,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(admin.user.id, "settings.update", "settings", "1", {});
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

/** Set (or clear) the logo or signature image from an uploaded public-assets object. */
export async function setBrandingImage(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(fd);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const target = z.enum(["logo_url", "certificate_signature_url"]).safeParse(fd.get("target"));
  const path = str(fd, "storage_path", 300);
  if (!target.success) return { ok: false, error: dict.errors.validation };
  let url: string | null = null;
  if (path) {
    const allowed = target.data === "certificate_signature_url" ? /^branding\/[0-9a-f-]{36}\.(png|jpg)$/ : /^branding\/[0-9a-f-]{36}\.(png|jpg|webp|svg)$/;
    if (!allowed.test(path) || !(await getObjectInfo("public-assets", path))) return { ok: false, error: dict.errors.uploadFailed };
    url = publicUrl(path);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("academy_settings").update({ [target.data]: url, updated_by: admin.user.id }).eq("id", 1);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(admin.user.id, "settings.branding", "settings", "1", { target: target.data });
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

export async function savePaymentMethod(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(fd);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const id = str(fd, "id");
  const schema = z.object({
    code: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(40),
    kind: z.enum(["bank_transfer", "mobile_money", "cash", "card", "online_gateway", "other"]),
    sort_order: z.coerce.number().int().min(0).max(1000),
  });
  const parsed = schema.safeParse({ code: str(fd, "code", 40).toLowerCase(), kind: str(fd, "kind"), sort_order: str(fd, "sort_order") || "0" });
  const name = Object.fromEntries(locales.map((l) => [l, str(fd, `name_${l}`, 100)]).filter(([, v]) => v));
  const instructions = Object.fromEntries(locales.map((l) => [l, str(fd, `instructions_${l}`, 5000)]).filter(([, v]) => v));
  if (!parsed.success || !Object.keys(name).length || (id && !z.uuid().safeParse(id).success)) return { ok: false, error: dict.errors.validation };
  const row = {
    ...parsed.data,
    name,
    instructions,
    requires_proof: bool(fd, "requires_proof"),
    requires_reference: bool(fd, "requires_reference"),
    is_active: bool(fd, "is_active"),
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("payment_methods").update(row).eq("id", id) : await supabase.from("payment_methods").insert({ ...row, provider: "manual" });
  if (error) return { ok: false, error: error.code === "23505" ? dict.errors.slug_taken : errorMessage(dict, error) };
  await audit(admin.user.id, id ? "payment_method.update" : "payment_method.create", "payment_method", id || row.code, { active: row.is_active });
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

export async function saveEmailTemplate(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { locale, dict, admin } = await guard(fd);
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  const key = str(fd, "key", 60) as TemplateKey;
  const tLocale = str(fd, "template_locale", 2);
  if (!templateKeys.includes(key) || !isLocale(tLocale)) return { ok: false, error: dict.errors.validation };
  const subject = str(fd, "subject", 200);
  const body = str(fd, "body", 10000);
  const supabase = await createClient();
  if (fd.get("reset") === "1" || (!subject && !body)) {
    await supabase.from("email_templates").delete().eq("key", key).eq("locale", tLocale);
  } else {
    if (!subject || !body) return { ok: false, error: dict.errors.validation };
    const { error } = await supabase.from("email_templates").upsert({ key, locale: tLocale, subject, body, updated_by: admin.user.id }, { onConflict: "key,locale" });
    if (error) return { ok: false, error: errorMessage(dict, error) };
  }
  await audit(admin.user.id, "email_template.update", "email_template", `${key}:${tLocale}`, {});
  revalidatePath(`/${locale}/admin/settings`);
  return { ok: true, message: dict.common.saved };
}
