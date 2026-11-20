import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { defaultTemplates, type TemplateKey } from "./templates";
import { interpolate, layoutEmail, renderBody } from "./render";

type Vars = Record<string, string | number | null | undefined>;
export type EmailStatus = "sent" | "failed" | "skipped";

/**
 * Provider abstraction. Resend is used when RESEND_API_KEY and EMAIL_FROM are set;
 * otherwise emails are recorded in email_log with status "skipped".
 */
async function deliver(to: string, subject: string, html: string, text: string): Promise<{ status: EmailStatus; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: "skipped", error: "email provider not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { status: "failed", error: body.message || `HTTP ${res.status}` };
    return { status: "sent", id: body.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Send a templated email. Never throws: failures are logged in email_log. */
export async function sendTemplate(opts: { key: TemplateKey; to: string; locale: string; vars: Vars; userId?: string | null }): Promise<EmailStatus> {
  const locale: Locale = isLocale(opts.locale) ? opts.locale : "nl";
  let subject = defaultTemplates[opts.key][locale].subject;
  let body = defaultTemplates[opts.key][locale].body;
  let academyName = "ARA AI Academy";
  let accent = "#4F46E5";
  try {
    const admin = createAdminClient();
    const [{ data: override }, { data: settings }] = await Promise.all([
      admin.from("email_templates").select("subject, body").eq("key", opts.key).eq("locale", locale).maybeSingle(),
      admin.from("academy_settings").select("academy_name, certificate_accent_color").eq("id", 1).maybeSingle(),
    ]);
    if (override?.subject?.trim()) subject = override.subject;
    if (override?.body?.trim()) body = override.body;
    if (settings?.academy_name) academyName = settings.academy_name;
    if (settings?.certificate_accent_color) accent = settings.certificate_accent_color;
  } catch {
    // fall back to defaults
  }

  const finalSubject = interpolate(subject, opts.vars);
  const { html, text } = renderBody(body, opts.vars, accent);
  const fullHtml = layoutEmail(html, { academyName, footer: getDictionary(locale).emailFooter, siteUrl: publicEnv.siteUrl });
  const result = await deliver(opts.to, finalSubject, fullHtml, text);

  try {
    await createAdminClient().from("email_log").insert({
      user_id: opts.userId ?? null,
      to_email: opts.to,
      template: opts.key,
      locale,
      subject: finalSubject,
      status: result.status,
      provider_message_id: result.id ?? null,
      error: result.error ?? null,
    });
  } catch (e) {
    console.error("email_log insert failed", e);
  }
  if (result.status === "failed") console.error(`email ${opts.key} to ${opts.to} failed: ${result.error}`);
  return result.status;
}
