import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const statuses = ["pending", "approved", "rejected", "refunded"] as const;

export default async function AdminPayments({ params, searchParams }: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const { status } = await searchParams;
  const dict = getDictionary(locale);
  const a = dict.admin.payments;
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select("id, amount, currency, status, reference, submitted_at, payment_date, student:profiles!payments_student_id_fkey(first_name, last_name, email), course:courses(course_translations(locale, title)), method:payment_methods(name)")
    .order("submitted_at", { ascending: false })
    .limit(200);
  const active = typeof status === "string" && (statuses as readonly string[]).includes(status) ? status : null;
  if (active) q = q.eq("status", active);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; amount: number; currency: string; status: "pending"; reference: string | null; submitted_at: string; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: { locale: string; title: string }[] } | null; method: { name: Localized } | null }[];
  const base = `/${locale}/admin/payments`;
  return (
    <>
      <PageHeader title={a.title} actions={<ButtonLink href={`/api/reports/revenue?format=csv&locale=${locale}`} variant="secondary" size="sm"><Download className="size-4" />{a.export}</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[null, ...statuses].map((s) => (
          <Link key={s ?? "all"} href={s ? `${base}?status=${s}` : base} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium ring-1", active === s ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>
            {s ? dict.paymentStatus[s] : dict.common.all}
          </Link>
        ))}
      </div>
      <Card>
        <Table>
          <thead className="bg-slate-50"><tr><Th>{a.student}</Th><Th>{a.course}</Th><Th>{dict.common.amount}</Th><Th>{a.method}</Th><Th>{a.reference}</Th><Th>{a.submitted}</Th><Th>{dict.common.status}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={7} className="py-8 text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`${base}/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</Link>
                  <p className="text-xs text-slate-500">{r.student?.email}</p>
                </Td>
                <Td>{r.course?.course_translations.find((t) => t.locale === locale)?.title}</Td>
                <Td className="whitespace-nowrap">{formatMoney(r.amount, r.currency, locale)}</Td>
                <Td>{tr(r.method?.name, locale, "—")}</Td>
                <Td className="font-mono text-xs">{r.reference || "—"}</Td>
                <Td className="whitespace-nowrap">{formatDate(r.submitted_at, locale, true)}</Td>
                <Td><Badge tone={statusTone[r.status]}>{dict.paymentStatus[r.status]}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
