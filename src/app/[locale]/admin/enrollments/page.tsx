import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysRemaining, formatDate } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

const statuses = ["pending", "active", "expired", "revoked", "cancelled"] as const;
type Tr = { locale: string; title: string }[];

export default async function AdminEnrollments({ params, searchParams }: PageProps<"/[locale]/admin/enrollments">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.enrollments;
  const { status } = await searchParams;
  const active = typeof status === "string" && (statuses as readonly string[]).includes(status) ? (status as (typeof statuses)[number]) : null;
  const supabase = await createClient();
  let q = supabase
    .from("enrollments")
    .select("id, student_id, status, source, requested_at, activated_at, expires_at, student:profiles!enrollments_student_id_fkey(first_name, last_name, email), course:courses(course_translations(locale, title))")
    .order("requested_at", { ascending: false })
    .limit(300);
  if (active === "expired") q = q.or(`status.eq.expired,and(status.eq.active,expires_at.lt.${new Date().toISOString()})`);
  else if (active === "active") q = q.eq("status", "active").gt("expires_at", new Date().toISOString());
  else if (active) q = q.eq("status", active);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; student_id: string; status: (typeof statuses)[number]; source: "self"; requested_at: string; activated_at: string | null; expires_at: string | null; student: { first_name: string; last_name: string; email: string } | null; course: { course_translations: Tr } | null }[];
  const base = `/${locale}/admin/enrollments`;
  return (
    <>
      <PageHeader title={a.title} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[null, ...statuses].map((s) => (
          <Link key={s ?? "all"} href={s ? `${base}?status=${s}` : base} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium ring-1", active === s ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>
            {s ? dict.enrollmentStatus[s] : dict.common.all}
          </Link>
        ))}
      </div>
      <Card>
        <Table>
          <thead className="bg-slate-50"><tr><Th>{dict.admin.payments.student}</Th><Th>{dict.admin.payments.course}</Th><Th>{a.requested}</Th><Th>{a.activated}</Th><Th>{a.expires}</Th><Th>{a.source}</Th><Th>{dict.common.status}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={7} className="py-8 text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => {
              const lapsed = r.status === "active" && r.expires_at && new Date(r.expires_at) <= new Date();
              const st = lapsed ? "expired" : r.status;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/${locale}/admin/students/${r.student_id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</Link>
                    <p className="text-xs text-slate-500">{r.student?.email}</p>
                  </Td>
                  <Td className="text-sm">{r.course?.course_translations.find((t) => t.locale === locale)?.title ?? r.course?.course_translations[0]?.title}</Td>
                  <Td className="whitespace-nowrap text-sm">{formatDate(r.requested_at, locale)}</Td>
                  <Td className="whitespace-nowrap text-sm">{formatDate(r.activated_at, locale)}</Td>
                  <Td className="whitespace-nowrap text-sm">
                    {formatDate(r.expires_at, locale)}
                    {st === "active" && r.expires_at ? <p className="text-xs text-slate-500">{fmt(dict.portal.daysRemaining, { days: daysRemaining(r.expires_at) })}</p> : null}
                  </Td>
                  <Td className="text-sm">{a.sources[r.source]}</Td>
                  <Td><Badge tone={statusTone[st]}>{dict.enrollmentStatus[st]}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
