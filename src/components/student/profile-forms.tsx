"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { updateProfile, changePassword, updateAvatar } from "@/app/actions/student";
import { uploadFile } from "@/components/forms/upload";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { countryOptions } from "@/lib/countries";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const { locale, dict } = useI18n();
  const a = dict.auth;
  return (
    <ActionForm action={updateProfile} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={a.firstName} htmlFor="first_name" required><Input id="first_name" name="first_name" defaultValue={profile.first_name} required maxLength={100} /></Field>
        <Field label={a.lastName} htmlFor="last_name" required><Input id="last_name" name="last_name" defaultValue={profile.last_name} required maxLength={100} /></Field>
        <Field label={a.phone} htmlFor="phone" required><Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} required maxLength={40} /></Field>
        <Field label={a.country} htmlFor="country" required>
          <Select id="country" name="country" defaultValue={profile.country}>
            {countryOptions(locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label={a.preferredLanguage} htmlFor="preferred_locale" required>
          <Select id="preferred_locale" name="preferred_locale" defaultValue={profile.preferred_locale}>
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={dict.profile.email} hint={dict.profile.emailHint}><Input value={profile.email} disabled readOnly /></Field>
      </div>
      <SubmitButton pendingLabel={dict.common.saving}>{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  const { locale, dict } = useI18n();
  return (
    <ActionForm action={changePassword} resetOnSuccess className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field label={dict.profile.newPassword} htmlFor="password" hint={dict.auth.passwordHint} required><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label={dict.auth.passwordConfirm} htmlFor="password_confirm" required><Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <SubmitButton variant="secondary">{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function AvatarUpload({ current, name }: { current: string | null; name: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const up = await uploadFile(file, "public-assets", locale, "avatar");
        const res = await updateAvatar(up.storage_path, locale);
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : dict.errors.uploadFailed);
      }
    });
  }
  return (
    <div className="flex items-center gap-5">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className="size-20 rounded-full object-cover ring-4 ring-brand-50" />
      ) : (
        <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-2xl font-bold text-white">{name.slice(0, 1).toUpperCase()}</span>
      )}
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {dict.profile.uploadAvatar}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onChange} disabled={busy} />
        </label>
        <p className="mt-1.5 text-xs text-slate-500">{dict.profile.avatarHint}</p>
        {error ? <Alert tone="error" className="mt-2">{error}</Alert> : null}
      </div>
    </div>
  );
}
