"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function SubmitButton({ children, pendingLabel, variant = "primary", size = "md", className, confirm, name, value }: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

type Action = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Form wired to a server action returning ActionResult, with inline success/error messages. */
export function ActionForm({ action, children, className, resetOnSuccess = false, onSuccess }: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state && !state.ok ? <Alert tone="error" className="mt-4">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success" className="mt-4">{state.message}</Alert> : null}
    </form>
  );
}

export function FieldError({ state, name }: { state: ActionResult | null; name: string }) {
  if (!state || state.ok || !state.fieldErrors?.[name]) return null;
  return <p className="mt-1 text-xs text-rose-600">{state.fieldErrors[name]}</p>;
}
