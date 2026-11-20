import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { CertificateActions } from "@/components/admin/admin-forms";

export default async function AdminCertificates({ params, searchParams }: PageProps<"/[locale]/admin/certificates">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const c = dict.admin.certificates;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.replace(/[,()*%\\]/g, " ").trim().slice(0, 100) : "";
  const supabase = await createClient();
  let query = supabase
    .from("certificates")
    .select("id, code, student_id, recipient_name, course_title, status, issued_at, completion_date, revoked_reason, revoked_at")
    .order("issued_at", { ascending: false })
    .limit(200);
  if (q) query = query.or(`code.ilike.%${q}%,recipient_name.ilike.%${q}%`);
  const { data } = await query;
  const rows = (data ?? []) as { id: string; code: string; student_id: string; recipient_name: string; course_title: Localized; status: "valid" | "revoked"; issued_at: string; completion_date: string; revoked_reason: string | null; revoked_at: string | null }[];
  return (
    <>
      <PageHeader title={c.title} />
      <form className="mb-4 flex max-w-xl gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={c.search} aria-label={c.search} />
        <button type="submit" className={buttonClass("secondary", "md")}><Search className="size-4" /><span className="sr-only">{dict.common.search}</span></button>
      </form>
      {rows.length === 0 ? <EmptyState title={dict.common.noResults} /> : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardBody className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{tr(r.course_title, locale)}</p>
                    <Badge tone={statusTone[r.status]}>{dict.certificateStatus[r.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600"><Link href={`/${locale}/admin/students/${r.student_id}`} className="font-medium hover:text-brand-700">{r.recipient_name}</Link></p>
                  <p className="mt-1 text-xs text-slate-500"><span className="font-mono">{r.code}</span> · {c.issued}: {formatDate(r.issued_at, locale)}</p>
                  {r.status === "revoked" ? <p className="mt-1 text-xs text-rose-700">{formatDate(r.revoked_at, locale)}: {r.revoked_reason}</p> : null}
                  <div className="mt-3 flex gap-3 text-sm">
                    <a href={`/api/certificates/${r.code}/pdf`} target="_blank" rel="noopener" className="font-medium text-brand-700 hover:underline">PDF</a>
                    <Link href={`/${locale}/verify/${r.code}`} className="font-medium text-brand-700 hover:underline">{dict.certificates.verifyLink}</Link>
                  </div>
                </div>
                <CertificateActions certificateId={r.id} status={r.status} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
