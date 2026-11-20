import type { Dictionary } from "@/i18n/dictionaries/nl";

type ErrorKey = keyof Dictionary["errors"];

/** Map a database / RPC error (raised with a code word) to a translated message. */
export function errorMessage(dict: Dictionary, error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const code = raw.trim().split(/\s/)[0] as ErrorKey;
  if (code && code in dict.errors) return dict.errors[code];
  if (/not_authorized|permission denied|42501/i.test(raw)) return dict.errors.notAuthorized;
  if (/not_found/i.test(raw)) return dict.errors.notFound;
  return dict.errors.generic;
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
