"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { passwordSchema, registerSchema, safeNext } from "@/lib/validation";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import type { ActionResult } from "@/lib/errors";

function localeOf(formData: FormData): Locale {
  const l = formData.get("locale");
  return isLocale(l) ? l : "nl";
}

export async function register(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = localeOf(formData);
  const dict = getDictionary(locale);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (fieldErrors[key]) continue;
      fieldErrors[key] =
        key === "password" ? dict.errors.passwordWeak
        : key === "password_confirm" ? dict.errors.passwordMismatch
        : key === "terms" ? dict.errors.termsRequired
        : dict.errors.validation;
    }
    return { ok: false, error: dict.errors.validation, fieldErrors };
  }
  if (!(await rateLimit("register", 5, 3600))) return { ok: false, error: dict.errors.rateLimited };

  const v = parsed.data;
  const supabase = await createClient();
  const next = safeNext(formData.get("next"), `/${v.preferred_locale}/dashboard`);
  const { error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        country: v.country,
        preferred_locale: v.preferred_locale,
        terms_accepted: "true",
      },
    },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { ok: false, error: dict.errors.emailTaken };
    if (/password/i.test(error.message)) return { ok: false, error: dict.errors.passwordWeak };
    console.error("signUp failed", error.message);
    return { ok: false, error: dict.errors.generic };
  }
  redirect(`/${locale}/check-email?email=${encodeURIComponent(v.email)}`);
}

export async function login(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = localeOf(formData);
  const dict = getDictionary(locale);
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.auth.invalidCredentials };
  const email = parsed.data.email.toLowerCase();
  if (!(await rateLimit("login", 10, 600, email))) return { ok: false, error: dict.errors.rateLimited };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { ok: false, error: dict.auth.emailNotConfirmed };
    return { ok: false, error: dict.auth.invalidCredentials };
  }
  const { data: profile } = await supabase.from("profiles").select("role, status, preferred_locale").eq("id", data.user.id).maybeSingle();
  if (profile?.status === "suspended") {
    await supabase.auth.signOut();
    return { ok: false, error: dict.auth.suspended };
  }
  const home = profile?.role === "admin" ? `/${locale}/admin` : `/${locale}/dashboard`;
  redirect(safeNext(formData.get("next"), home));
}

export async function forgotPassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = localeOf(formData);
  const dict = getDictionary(locale);
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  if (!(await rateLimit("forgot", 5, 3600))) return { ok: false, error: dict.errors.rateLimited };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.toLowerCase(), {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });
  // Always the same answer to avoid revealing which emails have accounts.
  return { ok: true, message: dict.auth.forgotSent };
}

export async function resetPassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const locale = localeOf(formData);
  const dict = getDictionary(locale);
  const password = formData.get("password");
  if (password !== formData.get("password_confirm")) return { ok: false, error: dict.errors.passwordMismatch, fieldErrors: { password_confirm: dict.errors.passwordMismatch } };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: dict.errors.passwordWeak, fieldErrors: { password: dict.errors.passwordWeak } };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: dict.auth.linkInvalid };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: /same/i.test(error.message) ? dict.errors.passwordWeak : dict.errors.generic };
  return { ok: true, message: dict.auth.resetDone };
}
