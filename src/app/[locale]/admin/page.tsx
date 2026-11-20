import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, UserCheck, Hourglass, Wallet, Banknote, GraduationCap, Percent, Award, CalendarX, ClipboardCheck } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader, StatCard, Table, Th, Td } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";

type Stats = {
  total_students: number; active_students: number; pending_enrollments: number; pending_payments: number; approved_payments: number;
  revenue: Record<string, number>; active_courses: number; activated_enrollments: number; completed_enrollments: number;
  certificates_issued: number; expired_enrollments: number; submissions_to_review: number;
};

export default async function AdminDashboard({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const s = dict.admin.stats;
  const supabase = await createClient();
  const [{ data: statsData }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("payments")
      .select("id, amount, currency, status, submitted_at, student:profiles!payments_student_id_fkey(first_name, last_name), course:courses(course_translations(locale, title))")
      .order("submitted_at", { ascending: false })
      .limit(8),
  ]);
  const st = (statsData ?? {}) as Stats;
  const revenue = Object.entries(st.revenue ?? {});
  const completion = st.activated_enrollments ? Math.round((100 * st.completed_enrollments) / st.activated_enrollments) : 0;
  const base = `/${locale}/admin`;
  const rows = (recent ?? []) as unknown as { id: string; amount: number; currency: string; status: "pending"; submitted_at: string; student: { first_name: string; last_name: string } | null; course: { course_translations: { locale: string; title: string }[] } | null }[];

  return (
    <>
      <PageHeader title={dict.admin.nav.dashboard} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={s.totalStudents} value={st.total_students ?? 0} icon={<Users className="size-4" />} />
        <StatCard label={s.activeStudents} value={st.active_students ?? 0} icon={<UserCheck className="size-4" />} />
        <Link href={`${base}/payments?status=pending`}><StatCard className="h-full ring-amber-200 transition hover:ring-amber-300" label={s.pendingPayments} value={st.pending_payments ?? 0} icon={<Hourglass className="size-4" />} /></Link>
        <StatCard label={s.pendingEnrollments} value={st.pending_enrollments ?? 0} icon={<Hourglass className="size-4" />} />
        <StatCard label={s.approvedPayments} value={st.approved_payments ?? 0} icon={<Wallet className="size-4" />} />
        <StatCard label={s.revenue} value={revenue.length ? revenue.map(([c, v]) => formatMoney(v, c, locale)).join(" · ") : formatMoney(0, "SRD", locale)} icon={<Banknote className="size-4" />} />
        <StatCard label={s.activeCourses} value={st.active_courses ?? 0} icon={<GraduationCap className="size-4" />} />
        <StatCard label={s.completionRate} value={`${completion}%`} icon={<Percent className="size-4" />} />
        <StatCard label={s.certificatesIssued} value={st.certificates_issued ?? 0} icon={<Award className="size-4" />} />
        <StatCard label={s.expiredEnrollments} value={st.expired_enrollments ?? 0} icon={<CalendarX className="size-4" />} />
        <Link href={`${base}/submissions`}><StatCard className="h-full transition hover:ring-brand-300" label={s.submissionsToReview} value={st.submissions_to_review ?? 0} icon={<ClipboardCheck className="size-4" />} /></Link>
      </div>

      <Card className="mt-8">
        <CardHeader title={dict.admin.recentPayments} action={<Link href={`${base}/payments`} className="text-sm font-semibold text-brand-600">{dict.admin.viewAll} →</Link>} />
        <Table>
          <thead className="bg-slate-50"><tr><Th>{dict.admin.payments.student}</Th><Th>{dict.admin.payments.course}</Th><Th>{dict.common.amount}</Th><Th>{dict.admin.payments.submitted}</Th><Th>{dict.common.status}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={5} className="text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td><Link href={`${base}/payments/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</Link></Td>
                <Td>{r.course?.course_translations.find((t) => t.locale === locale)?.title}</Td>
                <Td className="whitespace-nowrap">{formatMoney(r.amount, r.currency, locale)}</Td>
                <Td className="whitespace-nowrap">{formatDate(r.submitted_at, locale)}</Td>
                <Td><Badge tone={statusTone[r.status]}>{dict.paymentStatus[r.status]}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
