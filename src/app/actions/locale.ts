"use server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActionUser } from "@/lib/auth";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** Persist the chosen interface language (cookie + profile when signed in). */
export async function setPreferredLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const current = await getActionUser();
  if (current && current.profile.preferred_locale !== locale) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", current.user.id);
  }
}
