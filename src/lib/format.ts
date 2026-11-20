import type { Locale } from "@/i18n/config";

const intlLocale = (locale: Locale) => (locale === "nl" ? "nl-SR" : "en-US");

export function formatMoney(amount: number | string | null | undefined, currency: string, locale: Locale): string {
  const n = Number(amount ?? 0);
  try {
    // SRD is not in every ICU build; fall back to a manual format.
    return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, currencyDisplay: "code" }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatDate(value: string | Date | null | undefined, locale: Locale, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Paramaribo",
  }).format(d);
}

export function formatShortDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Paramaribo" }).format(d);
}

/** Whole days remaining until `expiresAt` (0 when expired). */
export function daysRemaining(expiresAt: string | Date | null | undefined, now: Date = new Date()): number {
  if (!expiresAt) return 0;
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** Milliseconds from now until the given timestamp (negative when past); null when no timestamp. */
export function msUntil(value: string | null | undefined): number | null {
  return value ? new Date(value).getTime() - Date.now() : null;
}
