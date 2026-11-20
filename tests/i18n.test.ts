import { describe, expect, it } from "vitest";
import nl from "@/i18n/dictionaries/nl";
import en from "@/i18n/dictionaries/en";

function paths(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
function placeholders(obj: unknown, prefix = "", out: Record<string, string[]> = {}) {
  if (typeof obj === "string") out[prefix] = [...obj.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) placeholders(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

describe("dictionaries", () => {
  it("NL and EN have exactly the same keys", () => {
    expect(paths(en).sort()).toEqual(paths(nl).sort());
  });
  it("use the same {placeholders} in both languages", () => {
    const a = placeholders(nl);
    const b = placeholders(en);
    for (const k of Object.keys(a)) expect(b[k], k).toEqual(a[k]);
  });
  it("contain no empty strings", () => {
    const empty = (o: unknown, p = ""): string[] => typeof o === "string" ? (o.trim() ? [] : [p]) : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => empty(v, `${p}.${k}`)) : [];
    expect(empty(nl)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });
  it("never claim accreditation", () => {
    const strings = (o: unknown): string[] => typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(strings) : [];
    for (const s of strings(en).filter((x) => /accredit/i.test(x) && !x.trim().endsWith("?"))) expect(s, s).toMatch(/\b(not|no)\b/i);
    for (const s of strings(nl).filter((x) => /accrediteerd|accreditatie/i.test(x) && !x.trim().endsWith("?"))) expect(s, s).toMatch(/\b(geen|niet)\b/i);
    expect(nl.certificates.pdfDisclaimer).toMatch(/geen/i);
    expect(en.certificates.pdfDisclaimer).toMatch(/not/i);
  });
});
