import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/data/catalog";
import { generateCertificatePdf } from "@/lib/certificate/pdf";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { tr, type Localized } from "@/lib/localize";
import { formatDate } from "@/lib/format";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Only fetch signature images from our own Supabase Storage (no arbitrary outbound requests). */
async function loadSignature(url: string | null): Promise<{ png?: Uint8Array; jpg?: Uint8Array }> {
  if (!url) return {};
  try {
    const u = new URL(url);
    const own = new URL(publicEnv.supabaseUrl);
    if (u.protocol !== "https:" || u.hostname !== own.hostname) return {};
    const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};
    const type = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 2 * 1024 * 1024) return {};
    if (type.includes("png")) return { png: buf };
    if (type.includes("jpeg") || type.includes("jpg")) return { jpg: buf };
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Certificate PDF. Available to the certificate holder and to admins. The public can verify
 * a certificate on /verify/[code] but cannot download someone else's PDF.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/certificates/[code]/pdf">) {
  const { code } = await ctx.params;
  const normalized = code.trim().toUpperCase();
  if (!/^ARA-\d{4}-[A-Z0-9]{8}$/.test(normalized)) return new NextResponse("Not found", { status: 404 });
  const current = await getCurrentUser();
  if (!current) {
    const loginLocale = isLocale(req.nextUrl.searchParams.get("lang")) ? req.nextUrl.searchParams.get("lang") : "nl";
    return NextResponse.redirect(new URL(`/${loginLocale}/login?next=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
  }
  const isAdmin = current.profile.role === "admin";
  const { data: cert } = await createAdminClient()
    .from("certificates")
    .select("code, student_id, recipient_name, course_title, locale, completion_date, status")
    .eq("code", normalized)
    .maybeSingle();
  if (!cert || (!isAdmin && (cert.student_id !== current.user.id || cert.status !== "valid"))) return new NextResponse("Not found", { status: 404 });

  const langParam = req.nextUrl.searchParams.get("lang");
  const locale = isLocale(langParam) ? langParam : isLocale(cert.locale) ? cert.locale : "nl";
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const sig = await loadSignature(settings.certificate_signature_url);
  const verifyUrl = `${publicEnv.siteUrl}/verify/${cert.code}`;
  const pdf = await generateCertificatePdf({
    recipientName: cert.recipient_name,
    courseTitle: tr(cert.course_title as Localized, locale, ""),
    completionDate: formatDate(cert.completion_date, locale),
    code: cert.code,
    verifyUrl,
    academyName: settings.academy_name,
    companyName: settings.company_name,
    signatoryName: settings.certificate_signatory_name,
    signatoryTitle: tr(settings.certificate_signatory_title as Localized, locale, "") || null,
    signaturePng: sig.png ?? null,
    signatureJpg: sig.jpg ?? null,
    accentColor: settings.certificate_accent_color || "#4F46E5",
    labels: {
      title: dict.certificates.pdfTitle,
      presented: dict.certificates.pdfPresented,
      completed: dict.certificates.pdfCompleted,
      date: dict.certificates.pdfDate,
      id: dict.certificates.pdfId,
      verify: dict.certificates.pdfVerify,
      disclaimer: dict.certificates.pdfDisclaimer,
    },
  });
  const revokedTag = cert.status === "valid" ? "" : "-REVOKED";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("download") ? "attachment" : "inline"}; filename="${cert.code}${revokedTag}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
