"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { emailAdmins } from "@/lib/notify";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import type { ActionResult } from "@/lib/errors";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10).max(5000),
});

export async function submitContact(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = isLocale(formData.get("locale")) ? (formData.get("locale") as "nl" | "en") : "nl";
  const dict = getDictionary(locale);
  if (formData.get("website")) return { ok: true, message: dict.contact.success }; // honeypot
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  if (!(await rateLimit("contact", 5, 3600))) return { ok: false, error: dict.errors.rateLimited };
  const v = parsed.data;
  const { error } = await createAdminClient().from("contact_messages").insert({ ...v, locale });
  if (error) return { ok: false, error: dict.errors.generic };
  await emailAdmins("contact_admin", { name: v.name, email: v.email, phone: v.phone ?? "—", subject: v.subject || "—", message: v.message });
  return { ok: true, message: dict.contact.success };
}
