"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActionUser } from "@/lib/auth";
import { getObjectInfo, publicUrl } from "@/lib/storage";
import { profileSchema, passwordSchema } from "@/lib/validation";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import type { ActionResult } from "@/lib/errors";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");

export async function markAllNotificationsRead() {
  const current = await getActionUser();
  if (!current) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", current.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function updateProfile(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const dict = getDictionary(loc(formData.get("locale")));
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", current.user.id);
  if (error) return { ok: false, error: dict.errors.generic };
  revalidatePath("/", "layout");
  return { ok: true, message: getDictionary(parsed.data.preferred_locale).profile.updated };
}

export async function updateAvatar(path: string, locale: string): Promise<ActionResult> {
  const dict = getDictionary(loc(locale));
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  if (!path.startsWith(`avatars/${current.user.id}/`)) return { ok: false, error: dict.errors.notAuthorized };
  if (!(await getObjectInfo("public-assets", path))) return { ok: false, error: dict.errors.uploadFailed };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl(path) }).eq("id", current.user.id);
  if (error) return { ok: false, error: dict.errors.generic };
  revalidatePath("/", "layout");
  return { ok: true, message: dict.profile.updated };
}

export async function changePassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const dict = getDictionary(loc(formData.get("locale")));
  const current = await getActionUser();
  if (!current) return { ok: false, error: dict.errors.notAuthorized };
  const password = formData.get("password");
  if (password !== formData.get("password_confirm")) return { ok: false, error: dict.errors.passwordMismatch };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: dict.errors.passwordWeak };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: dict.errors.passwordWeak };
  return { ok: true, message: dict.profile.passwordUpdated };
}
