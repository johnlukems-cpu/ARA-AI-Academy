import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, DefinitionList } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { PaymentReviewPanel, PaymentNotesForm } from "@/components/admin/payment-actions";

export default async function AdminPaymentDetail({ params }: PageProps<"/[locale]/admin/payments/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.payments;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, student:profiles!payments_student_id_fkey(id, first_name, last_name, email, phone), reviewer:profiles!payments_reviewed_by_fkey(first_name, last_name), course:courses(slug, course_translations(locale, title)), method:payment_methods(name), enrollment:enrollments(id, status, expires_at), payment_evidence(id, file_name, mime_type, file_size, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as unknown as {
    id: string; amount: number; currency: string; status: "pending" | "approved" | "rejected" | "refunded"; reference: string | null; payment_date: string | null;
    submitted_at: string; reviewed_at: string | null; admin_notes: string | null; student_note: string | null; rejection_reason: string | null; provider: string;
    student: { id: string; first_name: string; last_name: string; email: string; phone: string | null } | null;
    reviewer: { first_name: string; last_name: string } | null;
    course: { slug: string; course_translations: { locale: string; title: string }[] } | null;
    method: { name: Localized } | null;
    enrollment: { id: string; status: "pending"; expires_at: string | null } | null;
    payment_evidence: { id: string; file_name: string; mime_type: string | null; file_size: number | null; created_at: string }[];
  };
  const courseTitle = p.course?.course_translations.find((t) => t.locale === locale)?.title ?? "";
  return (
    <>
      <PageHeader
        title={`${a.title}: ${p.student?.first_name ?? ""} ${p.student?.last_name ?? ""}`}
        description={courseTitle}
        actions={<Badge tone={statusTone[p.status]} className="text-sm">{dict.paymentStatus[p.status]}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={dict.common.details} />
            <CardBody>
              <DefinitionList
                items={[
                  [a.student, p.student ? <Link key="s" href={`/${locale}/admin/students/${p.student.id}`} className="text-brand-700 hover:underline">{p.student.first_name} {p.student.last_name} · {p.student.email}{p.student.phone ? ` · ${p.student.phone}` : ""}</Link> : "—"],
                  [a.course, courseTitle],
                  [dict.common.amount, formatMoney(p.amount, p.currency, locale)],
                  [a.method, tr(p.method?.name, locale, "—")],
                  [a.paymentDate, formatDate(p.payment_date, locale)],
                  [a.reference, <span key="r" className="font-mono">{p.reference || "—"}</span>],
                  [a.submitted, formatDate(p.submitted_at, locale, true)],
                  [a.studentNote, p.student_note || "—"],
                  [a.reviewedBy, p.reviewer ? `${p.reviewer.first_name} ${p.reviewer.last_name}` : "—"],
                  [a.reviewedAt, formatDate(p.reviewed_at, locale, true)],
                  ...(p.rejection_reason ? ([[a.rejectReason, p.rejection_reason]] as [string, string][]) : []),
                  [dict.admin.enrollments.title, p.enrollment ? `${dict.enrollmentStatus[p.enrollment.status]}${p.enrollment.expires_at ? ` · ${dict.admin.enrollments.expires} ${formatDate(p.enrollment.expires_at, locale)}` : ""}` : "—"],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={a.proof} />
            <CardBody>
              {p.payment_evidence.length === 0 ? (
                <p className="text-sm text-slate-500">{a.noProof}</p>
              ) : (
                <ul className="space-y-3">
                  {p.payment_evidence.map((ev) => (
                    <li key={ev.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-brand-600" />
                        <span className="flex-1 truncate text-sm font-medium">{ev.file_name}</span>
                        <a href={`/api/files/evidence/${ev.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">{a.viewProof}<ExternalLink className="size-3.5" /></a>
                      </div>
                      {ev.mime_type?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/files/evidence/${ev.id}`} alt={ev.file_name} className="mt-3 max-h-[480px] w-full rounded-lg bg-slate-50 object-contain" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <PaymentReviewPanel paymentId={p.id} status={p.status} />
          <Card>
            <CardHeader title={a.adminNotes} />
            <CardBody><PaymentNotesForm paymentId={p.id} notes={p.admin_notes ?? ""} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
