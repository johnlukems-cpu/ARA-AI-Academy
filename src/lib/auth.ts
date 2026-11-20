import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/i18n/config";
import type { Profile } from "@/lib/types";

/** Current verified user + profile for this request (null when signed out). */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  if (!profile) return null;
  return { user, profile, emailConfirmed: Boolean(user.email_confirmed_at) };
});

export async function requireUser(locale: Locale, next?: string) {
  const current = await getCurrentUser();
  if (!current) redirect(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (current.profile.status !== "active") {
    redirect(`/auth/signout?locale=${locale}&reason=suspended`);
  }
  return current;
}

export async function requireAdmin(locale: Locale) {
  const current = await requireUser(locale);
  if (current.profile.role !== "admin") notFound();
  return current;
}

/** For server actions: returns the active user or null (never redirects). */
export async function getActionUser() {
  const current = await getCurrentUser();
  if (!current || current.profile.status !== "active") return null;
  return current;
}

export async function getActionAdmin() {
  const current = await getActionUser();
  if (!current || current.profile.role !== "admin") return null;
  return current;
}
