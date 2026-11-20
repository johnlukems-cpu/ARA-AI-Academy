import type { Locale } from "@/i18n/config";

export type Localized<T = string> = Partial<Record<string, T>> | null | undefined;

/**
 * Read a locale-keyed jsonb value. Falls back to the other language only when the
 * requested translation is missing (publishing requires both, so this is a safety net).
 */
export function tr<T = string>(value: Localized<T>, locale: Locale, fallback?: T): T {
  if (!value) return fallback as T;
  const v = value[locale];
  if (v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== "")) return v;
  const other = value[locale === "nl" ? "en" : "nl"];
  if (other !== undefined && other !== null && (typeof other !== "string" || other.trim() !== "")) return other;
  return fallback as T;
}

export function hasBothLocales(value: Localized<string>): boolean {
  return Boolean(value?.nl?.trim() && value?.en?.trim());
}
