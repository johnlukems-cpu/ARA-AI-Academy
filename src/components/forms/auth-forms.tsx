"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { login, register, forgotPassword, resetPassword } from "@/app/actions/auth";
import { FieldError, SubmitButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { countryOptions } from "@/lib/countries";

export function LoginForm({ next }: { next?: string }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={dict.auth.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={dict.auth.password} htmlFor="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="text-right">
        <Link href={`/${locale}/forgot-password`} className="text-sm font-medium text-brand-600 hover:text-brand-700">{dict.auth.forgot}</Link>
      </div>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>{dict.auth.loginButton}</SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { locale, dict } = useI18n();
  const a = dict.auth;
  const [state, action] = useActionState(register, null);
  const [before, rest] = a.acceptTerms.split("{terms}");
  const [middle, after] = (rest ?? "").split("{privacy}");
  return (
    <form action={action} className="space-y-4" noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={a.firstName} htmlFor="first_name" required>
          <Input id="first_name" name="first_name" autoComplete="given-name" required maxLength={100} />
          <FieldError state={state} name="first_name" />
        </Field>
        <Field label={a.lastName} htmlFor="last_name" required>
          <Input id="last_name" name="last_name" autoComplete="family-name" required maxLength={100} />
          <FieldError state={state} name="last_name" />
        </Field>
      </div>
      <Field label={a.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError state={state} name="email" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={a.phone} htmlFor="phone" required>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="+597 …" maxLength={40} />
          <FieldError state={state} name="phone" />
        </Field>
        <Field label={a.country} htmlFor="country" required>
          <Select id="country" name="country" defaultValue="SR" required>
            {countryOptions(locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={a.preferredLanguage} htmlFor="preferred_locale" required>
        <Select id="preferred_locale" name="preferred_locale" defaultValue={locale}>
          <option value="nl">Nederlands</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field label={a.password} htmlFor="password" hint={a.passwordHint} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        <FieldError state={state} name="password" />
      </Field>
      <Field label={a.passwordConfirm} htmlFor="password_confirm" required>
        <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={10} />
        <FieldError state={state} name="password_confirm" />
      </Field>
      <Checkbox
        name="terms"
        required
        label={
          <>
            {before}
            <Link href={`/${locale}/terms`} target="_blank" className="font-medium text-brand-600 underline">{dict.nav.terms.toLowerCase()}</Link>
            {middle}
            <Link href={`/${locale}/privacy`} target="_blank" className="font-medium text-brand-600 underline">{dict.nav.privacy.toLowerCase()}</Link>
            {after}
          </>
        }
      />
      <FieldError state={state} name="terms" />
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.submitting}>{a.registerButton}</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(forgotPassword, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field label={dict.auth.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" size="lg">{dict.auth.forgotButton}</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(resetPassword, null);
  if (state?.ok)
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href={`/${locale}/dashboard`} className="block text-center text-sm font-semibold text-brand-600">{dict.nav.dashboard} →</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field label={dict.profile.newPassword} htmlFor="password" hint={dict.auth.passwordHint} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        <FieldError state={state} name="password" />
      </Field>
      <Field label={dict.auth.passwordConfirm} htmlFor="password_confirm" required>
        <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={10} />
        <FieldError state={state} name="password_confirm" />
      </Field>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton className="w-full" size="lg">{dict.auth.resetButton}</SubmitButton>
    </form>
  );
}

