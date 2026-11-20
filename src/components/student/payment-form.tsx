"use client";
import { startTransition, useActionState, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Upload } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { submitPayment } from "@/app/actions/enrollment";
import { uploadFile } from "@/components/forms/upload";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { Localized } from "@/lib/localize";

type Method = { id: string; name: Localized; instructions: Localized; requires_proof: boolean; requires_reference: boolean };

const pick = (v: Localized, locale: string) => v?.[locale] || v?.nl || v?.en || "";

export function PaymentForm({ enrollmentId, methods, amountLabel }: { enrollmentId: string; methods: Method[]; amountLabel: string }) {
  const { locale, dict } = useI18n();
  const e = dict.enroll;
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [state, dispatch, pending] = useActionState(submitPayment, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const method = methods.find((m) => m.id === methodId);
  const today = new Date().toISOString().slice(0, 10);

  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setUploadError(null);
    const fd = new FormData(ev.currentTarget);
    const file = fd.get("file");
    fd.delete("file");
    if (file instanceof File && file.size > 0) {
      setUploading(true);
      try {
        const uploaded = await uploadFile(file, "payment-proofs", locale);
        fd.set("evidence", JSON.stringify([uploaded]));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : dict.errors.uploadFailed);
        setUploading(false);
        return;
      }
      setUploading(false);
    } else {
      fd.set("evidence", "[]");
    }
    startTransition(() => dispatch(fd));
  }

  const busy = uploading || pending;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-900">{e.chooseMethod}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {methods.map((m) => (
            <label key={m.id} className={cn("cursor-pointer rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors", m.id === methodId ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")}>
              <input type="radio" name="payment_method_id" value={m.id} checked={m.id === methodId} onChange={() => setMethodId(m.id)} className="sr-only" />
              {pick(m.name, locale)}
            </label>
          ))}
        </div>
      </fieldset>

      {method ? (
        <div className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{e.paymentInstructions}</p>
          <p className="mb-3 font-display text-xl font-bold text-slate-900">{amountLabel}</p>
          <div className="prose-lesson text-sm"><ReactMarkdown>{pick(method.instructions, locale)}</ReactMarkdown></div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={e.paymentDate} htmlFor="payment_date" required>
          <Input id="payment_date" name="payment_date" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label={e.reference} htmlFor="reference" required={method?.requires_reference}>
          <Input id="reference" name="reference" maxLength={120} required={method?.requires_reference} />
        </Field>
      </div>
      <Field label={e.proof} htmlFor="file" required={method?.requires_proof}>
        <Input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required={method?.requires_proof} className="file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700" />
      </Field>
      <Field label={e.note} htmlFor="note">
        <Textarea id="note" name="note" maxLength={1000} rows={3} />
      </Field>
      {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <button type="submit" disabled={busy || !methodId} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? e.uploading : busy ? dict.common.submitting : e.submitPayment}
      </button>
    </form>
  );
}
