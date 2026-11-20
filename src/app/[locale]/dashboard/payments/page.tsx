import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, EmptyState, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";

type Row = { id: string; amount: number; currency: string; status: "pending"; reference: string | null; submitted_at: string; reviewed_at: string | null; rejection_reason: string | null; method: { name: Localized } | null; course: { course_translations: { locale: string; title: string }[] } | null };

export default async function PaymentsPage({ params }: PageProps<"/[locale]/dashboard/payments">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { user } = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, currency, status, reference, submitted_at, reviewed_at, rejection_reason, method:payment_methods(name), course:courses(course_translations(locale, title))")
    .eq("student_id", user.id)
    .order("submitted_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <PageHeader title={dict.payments.title} />
      {rows.length === 0 ? (
        <EmptyState title={dict.payments.empty} />
      ) : (
        <Card>
          <Table>
            <thead className="bg-slate-50"><tr><Th>{dict.enroll.course}</Th><Th>{dict.common.amount}</Th><Th>{dict.payments.method}</Th><Th>{dict.payments.reference}</Th><Th>{dict.payments.submitted}</Th><Th>{dict.common.status}</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium text-slate-900">{r.course?.course_translations.find((t) => t.locale === locale)?.title ?? r.course?.course_translations[0]?.title}</Td>
                  <Td className="whitespace-nowrap">{formatMoney(r.amount, r.currency, locale)}</Td>
                  <Td>{tr(r.method?.name, locale, "—")}</Td>
                  <Td className="font-mono text-xs">{r.reference || "—"}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.submitted_at, locale)}</Td>
                  <Td>
                    <Badge tone={statusTone[r.status]}>{dict.paymentStatus[r.status]}</Badge>
                    {r.rejection_reason ? <p className="mt-1 max-w-xs text-xs text-rose-600">{r.rejection_reason}</p> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
