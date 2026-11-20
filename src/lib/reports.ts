import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeText } from "@/lib/certificate/pdf";
import { tr, type Localized } from "@/lib/localize";
import type { Locale } from "@/i18n/config";

export const reportTypes = ["registrations", "revenue", "enrollments", "completion", "exams", "certificates", "monthly"] as const;
export type ReportType = (typeof reportTypes)[number];
export type Report = { columns: string[]; rows: (string | number | null)[][] };

type Tr = { locale: string; title: string }[];
const courseTitle = (t: Tr | undefined, locale: string) => t?.find((x) => x.locale === locale)?.title ?? t?.[0]?.title ?? "";
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
const person = (p: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}`.trim() : "");

/** Build a report for [from, to] (inclusive dates, YYYY-MM-DD). Caller must verify admin rights. */
export async function buildReport(type: ReportType, from: string, to: string, locale: Locale): Promise<Report> {
  const db = createAdminClient();
  const start = `${from}T00:00:00Z`;
  const end = `${to}T23:59:59.999Z`;
  const nl = locale === "nl";
  switch (type) {
    case "registrations": {
      const { data } = await db.from("profiles").select("created_at, first_name, last_name, email, phone, country, preferred_locale, role, status").gte("created_at", start).lte("created_at", end).order("created_at");
      return {
        columns: nl ? ["Datum", "Voornaam", "Achternaam", "E-mail", "Telefoon", "Land", "Taal", "Rol", "Status"] : ["Date", "First name", "Last name", "Email", "Phone", "Country", "Language", "Role", "Status"],
        rows: (data ?? []).map((r) => [day(r.created_at), r.first_name, r.last_name, r.email, r.phone, r.country, r.preferred_locale, r.role, r.status]),
      };
    }
    case "revenue": {
      const { data } = await db
        .from("payments")
        .select("submitted_at, reviewed_at, amount, currency, status, reference, payment_date, student:profiles!payments_student_id_fkey(first_name, last_name, email), course:courses(course_translations(locale, title)), method:payment_methods(name)")
        .gte("submitted_at", start).lte("submitted_at", end).order("submitted_at");
      const rows = (data ?? []) as unknown as { submitted_at: string; reviewed_at: string | null; amount: number; currency: string; status: string; reference: string | null; payment_date: string | null; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: Tr } | null; method: { name: Localized } | null }[];
      return {
        columns: nl ? ["Ingediend", "Betaaldatum", "Beoordeeld", "Student", "E-mail", "Cursus", "Methode", "Referentie", "Bedrag", "Valuta", "Status"] : ["Submitted", "Payment date", "Reviewed", "Student", "Email", "Course", "Method", "Reference", "Amount", "Currency", "Status"],
        rows: rows.map((r) => [day(r.submitted_at), r.payment_date, day(r.reviewed_at), person(r.student), r.student?.email ?? "", courseTitle(r.course?.course_translations, locale), tr(r.method?.name, locale, ""), r.reference, Number(r.amount), r.currency, r.status]),
      };
    }
    case "enrollments": {
      const { data } = await db
        .from("enrollments")
        .select("requested_at, activated_at, expires_at, status, source, student:profiles!enrollments_student_id_fkey(first_name, last_name, email), course:courses(course_translations(locale, title))")
        .gte("requested_at", start).lte("requested_at", end).order("requested_at");
      const rows = (data ?? []) as unknown as { requested_at: string; activated_at: string | null; expires_at: string | null; status: string; source: string; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: Tr } | null }[];
      return {
        columns: nl ? ["Aangevraagd", "Geactiveerd", "Verloopt", "Student", "E-mail", "Cursus", "Bron", "Status"] : ["Requested", "Activated", "Expires", "Student", "Email", "Course", "Source", "Status"],
        rows: rows.map((r) => [day(r.requested_at), day(r.activated_at), day(r.expires_at), person(r.student), r.student?.email ?? "", courseTitle(r.course?.course_translations, locale), r.source, r.status]),
      };
    }
    case "completion": {
      const { data } = await db
        .from("enrollments")
        .select("student_id, course_id, activated_at, completed_at, status, student:profiles!enrollments_student_id_fkey(first_name, last_name, email), course:courses(course_translations(locale, title))")
        .not("activated_at", "is", null).gte("activated_at", start).lte("activated_at", end).order("activated_at");
      const rows = (data ?? []) as unknown as { student_id: string; course_id: string; activated_at: string; completed_at: string | null; status: string; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: Tr } | null }[];
      const out: Report["rows"] = [];
      for (const r of rows) {
        const { data: p } = await db.rpc("course_progress", { p_student: r.student_id, p_course: r.course_id });
        const pr = (p as { percentage: number; completed_lessons: number; total_lessons: number }[] | null)?.[0];
        out.push([day(r.activated_at), person(r.student), r.student?.email ?? "", courseTitle(r.course?.course_translations, locale), pr?.completed_lessons ?? 0, pr?.total_lessons ?? 0, pr?.percentage ?? 0, day(r.completed_at), r.status]);
      }
      return {
        columns: nl ? ["Geactiveerd", "Student", "E-mail", "Cursus", "Voltooide lessen", "Totaal lessen", "Voortgang %", "Afgerond op", "Status"] : ["Activated", "Student", "Email", "Course", "Lessons done", "Total lessons", "Progress %", "Completed on", "Status"],
        rows: out,
      };
    }
    case "exams": {
      const { data } = await db
        .from("quiz_attempts")
        .select("submitted_at, attempt_number, percentage, passed, status, student:profiles!quiz_attempts_student_id_fkey(first_name, last_name, email), quiz:quizzes!inner(kind, title), course:courses(course_translations(locale, title))")
        .eq("quiz.kind", "final_exam").neq("status", "in_progress").gte("submitted_at", start).lte("submitted_at", end).order("submitted_at");
      const rows = (data ?? []) as unknown as { submitted_at: string; attempt_number: number; percentage: number | null; passed: boolean | null; status: string; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: Tr } | null }[];
      return {
        columns: nl ? ["Datum", "Student", "E-mail", "Cursus", "Poging", "Score %", "Resultaat"] : ["Date", "Student", "Email", "Course", "Attempt", "Score %", "Result"],
        rows: rows.map((r) => [day(r.submitted_at), person(r.student), r.student?.email ?? "", courseTitle(r.course?.course_translations, locale), r.attempt_number, r.percentage === null ? null : Number(r.percentage), r.passed ? (nl ? "Geslaagd" : "Passed") : (nl ? "Niet geslaagd" : "Failed")]),
      };
    }
    case "certificates": {
      const { data } = await db.from("certificates").select("issued_at, code, recipient_name, course_title, status, revoked_at").gte("issued_at", start).lte("issued_at", end).order("issued_at");
      return {
        columns: nl ? ["Uitgegeven", "Certificaat-ID", "Ontvanger", "Cursus", "Status", "Ingetrokken op"] : ["Issued", "Certificate ID", "Recipient", "Course", "Status", "Revoked on"],
        rows: (data ?? []).map((r) => [day(r.issued_at), r.code, r.recipient_name, tr(r.course_title as Localized, locale, ""), r.status, day(r.revoked_at)]),
      };
    }
    case "monthly": {
      const [{ data: profiles }, { data: payments }, { data: enrollments }, { data: certs }] = await Promise.all([
        db.from("profiles").select("created_at").gte("created_at", start).lte("created_at", end),
        db.from("payments").select("reviewed_at, amount, currency").eq("status", "approved").gte("reviewed_at", start).lte("reviewed_at", end),
        db.from("enrollments").select("activated_at").not("activated_at", "is", null).gte("activated_at", start).lte("activated_at", end),
        db.from("certificates").select("issued_at").gte("issued_at", start).lte("issued_at", end),
      ]);
      const months = new Map<string, { reg: number; enr: number; cert: number; revenue: Record<string, number> }>();
      const m = (d: string | null) => {
        const k = (d ?? "").slice(0, 7);
        if (!months.has(k)) months.set(k, { reg: 0, enr: 0, cert: 0, revenue: {} });
        return months.get(k)!;
      };
      (profiles ?? []).forEach((r) => m(r.created_at).reg++);
      (enrollments ?? []).forEach((r) => m(r.activated_at).enr++);
      (certs ?? []).forEach((r) => m(r.issued_at).cert++);
      (payments ?? []).forEach((r) => { const x = m(r.reviewed_at); x.revenue[r.currency] = (x.revenue[r.currency] ?? 0) + Number(r.amount); });
      return {
        columns: nl ? ["Maand", "Registraties", "Geactiveerde inschrijvingen", "Certificaten", "Omzet"] : ["Month", "Registrations", "Activated enrollments", "Certificates", "Revenue"],
        rows: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.reg, v.enr, v.cert, Object.entries(v.revenue).map(([c, a]) => `${c} ${a.toFixed(2)}`).join(" / ")]),
      };
    }
  }
}

/** RFC 4180 CSV with a UTF-8 BOM (so Excel opens accents correctly). Neutralises spreadsheet formulas. */
export function toCsv(report: Report): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [report.columns, ...report.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function toPdf(report: Report, title: string, subtitle: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89, H = 595.28, M = 36;
  const usable = W - M * 2;
  const n = report.columns.length;
  // Column widths proportional to content length (capped).
  const weights = report.columns.map((c, i) => Math.min(40, Math.max(c.length, ...report.rows.slice(0, 200).map((r) => String(r[i] ?? "").length))));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const widths = weights.map((w) => (w / total) * usable);
  const size = n > 9 ? 6.5 : 7.5;
  const fit = (s: string, w: number, f = font) => {
    let t = safeText(s, f);
    while (t.length > 1 && f.widthOfTextAtSize(t, size) > w - 4) t = t.slice(0, -2) + "…";
    return safeText(t, f);
  };
  let page = doc.addPage([W, H]);
  let y = H - M;
  const header = () => {
    let x = M;
    page.drawRectangle({ x: M, y: y - 4, width: usable, height: 14, color: rgb(0.93, 0.94, 0.98) });
    report.columns.forEach((c, i) => { page.drawText(fit(c, widths[i], bold), { x: x + 2, y, size, font: bold, color: rgb(0.1, 0.1, 0.2) }); x += widths[i]; });
    y -= 16;
  };
  page.drawText(safeText(title, bold), { x: M, y, size: 14, font: bold });
  y -= 16;
  page.drawText(safeText(subtitle, font), { x: M, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) });
  y -= 22;
  header();
  for (const row of report.rows) {
    if (y < M + 10) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    let x = M;
    row.forEach((v, i) => { page.drawText(fit(String(v ?? ""), widths[i]), { x: x + 2, y, size, font, color: rgb(0.15, 0.15, 0.2) }); x += widths[i]; });
    y -= 12;
  }
  if (report.rows.length === 0) page.drawText("—", { x: M, y, size: 9, font });
  return doc.save();
}
