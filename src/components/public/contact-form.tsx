"use client";
import { useI18n } from "@/i18n/client";
import { submitContact } from "@/app/actions/public";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";

export function ContactForm() {
  const { locale, dict } = useI18n();
  const c = dict.contact;
  return (
    <ActionForm action={submitContact} resetOnSuccess className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="hidden" aria-hidden>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.name} htmlFor="name" required><Input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" /></Field>
        <Field label={c.email} htmlFor="email" required><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
        <Field label={c.phone} htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} /></Field>
        <Field label={c.subject} htmlFor="subject"><Input id="subject" name="subject" maxLength={200} /></Field>
      </div>
      <Field label={c.message} htmlFor="message" required><Textarea id="message" name="message" required minLength={10} maxLength={5000} rows={6} /></Field>
      <SubmitButton pendingLabel={dict.common.submitting}>{c.send}</SubmitButton>
    </ActionForm>
  );
}
