import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildReport, reportTypes, toCsv, toPdf, type ReportType } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";

export const runtime = "nodejs";

const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));

export async function GET(req: NextRequest, ctx: RouteContext<"/api/reports/[type]">) {
  const { type } = await ctx.params;
  const current = await getCurrentUser();
  if (!current || current.profile.role !== "admin" || current.profile.status !== "active") return new NextResponse("Not found", { status: 404 });
  if (!(reportTypes as readonly string[]).includes(type)) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const locale = isLocale(sp.get("locale")) ? (sp.get("locale") as "nl" | "en") : "nl";
  const today = new Date().toISOString().slice(0, 10);
  const to = isDate(sp.get("to")) ? sp.get("to")! : today;
  const from = isDate(sp.get("from")) ? sp.get("from")! : `${new Date().getUTCFullYear() - 1}-01-01`;
  const format = sp.get("format") === "pdf" ? "pdf" : "csv";
  const report = await buildReport(type as ReportType, from, to, locale);
  await audit(current.user.id, "report.export", "report", type, { from, to, format, rows: report.rows.length });
  const name = `ara-${type}-${from}_${to}`;
  if (format === "csv") {
    return new NextResponse(toCsv(report), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" },
    });
  }
  const dict = getDictionary(locale);
  const pdf = await toPdf(report, `ARA AI Academy – ${dict.admin.reports.types[type as ReportType]}`, `${from} – ${to} · ${report.rows.length}`);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
