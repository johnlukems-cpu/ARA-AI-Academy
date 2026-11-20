import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/catalog";
import { daysRemaining, formatDate, formatMoney } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { countryName } from "@/lib/countries";
import { PageHeader, DefinitionList, Table, Th, Td } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ManualEnrollForm, EnrollmentActions, AccountActions } from "@/components/admin/admin-forms";

type Tr = { locale: string; title: string }[];
const titleOf = (t: Tr | undefined, locale: string) => t?.find((x) => x.locale === locale)?.title ?? t?.[0]?.title ?? "—";

export default async function AdminStudentDetail({ params }: PageProps<"/[locale]/admin/students/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const me = await requireAdmin(locale);
  const dict = getDictionary(locale);
  const s = dict.admin.students;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();
  const [{ data: enrollments }, { data: payments }, { data: certs }, { data: courses }, { data: methods }, { data: attempts }, settings] = await Promise.all([
    supabase.from("enrollments").select("id, course_id, status, source, requested_at, activated_at, expires_at, completed_at, last_lesson_id, course:courses(course_translations(locale, title)), last_lesson:lessons!enrollments_last_lesson_id_fkey(title)").eq("student_id", id).order("requested_at", { ascending: false }),
    supabase.from("payments").select("id, amount, currency, status, submitted_at, reference, course:courses(course_translations(locale, title))").eq("student_id", id).order("submitted_at", { ascending: false }),
    supabase.from("certificates").select("id, code, status, issued_at, course_title").eq("student_id", id).order("issued_at", { ascending: false }),
    supabase.from("courses").select("id, status, course_translations(locale, title)").neq("status", "archived").order("sort_order"),
    supabase.from("payment_methods").select("id, name").order("sort_order"),
    supabase.from("quiz_attempts").select("course_id, percentage, passed, quiz:quizzes!inner(kind)").eq("student_id", id).eq("quiz.kind", "final_exam").neq("status", "in_progress"),
    getSettings(),
  ]);
  const enr = (enrollments ?? []) as unknown as { id: string; course_id: string; status: string; source: "self"; requested_at: string; activated_at: string | null; expires_at: string | null; completed_at: string | null; course: { course_translations: Tr } | null; last_lesson: { title: Localized } | null }[];
  const progress = new Map(
    await Promise.all(enr.filter((e) => e.status !== "pending" && e.status !== "cancelled").map(async (e) => {
      const { data } = await supabase.rpc("course_progress", { p_student: id, p_course: e.course_id });
      return [e.id, (data as { percentage: number; completed_lessons: number; total_lessons: number }[] | null)?.[0]] as const;
    })),
  );
  const best = new Map<string, number>();
  for (const a of (attempts ?? []) as { course_id: string; percentage: number | null }[]) {
    if (a.percentage !== null) best.set(a.course_id, Math.max(best.get(a.course_id) ?? 0, Number(a.percentage)));
  }
  const name = `${profile.first_name} ${profile.last_name}`.trim() || profile.email;

  return (
    <>
      <Link href={`/${locale}/admin/students`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{s.title}</Link>
      <PageHeader
        title={name}
        description={<span className="flex flex-wrap gap-2"><Badge tone={statusTone[profile.status]}>{dict.accountStatus[profile.status as "active"]}</Badge><Badge tone={profile.role === "admin" ? "brand" : "neutral"}>{dict.roles[profile.role as "student"]}</Badge></span>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={s.learningProgress} />
            {enr.length === 0 ? <CardBody><p className="text-sm text-slate-500">{s.noEnrollments}</p></CardBody> : (
              <ul className="divide-y divide-slate-100">
                {enr.map((e) => {
                  const p = progress.get(e.id);
                  const live = e.status === "active" && e.expires_at && new Date(e.expires_at) > new Date();
                  return (
                    <li key={e.id} className="space-y-3 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{titleOf(e.course?.course_translations, locale)}</p>
                          <p className="text-xs text-slate-500">
                            {dict.admin.enrollments.requested}: {formatDate(e.requested_at, locale)} · {dict.admin.enrollments.source}: {dict.admin.enrollments.sources[e.source]}
                            {e.expires_at ? <> · {dict.admin.enrollments.expires}: {formatDate(e.expires_at, locale)}{live ? ` (${fmt(dict.portal.daysRemaining, { days: daysRemaining(e.expires_at) })})` : ""}</> : null}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Badge tone={statusTone[live || e.status !== "active" ? e.status : "expired"]}>{dict.enrollmentStatus[(live || e.status !== "active" ? e.status : "expired") as "active"]}</Badge>
                          {e.completed_at ? <Badge tone="brand">{dict.learn.completed}</Badge> : null}
                        </div>
                      </div>
                      {p ? (
                        <div className="max-w-md">
                          <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{dict.portal.progress}</span><span>{p.percentage}% · {p.completed_lessons}/{p.total_lessons}</span></div>
                          <ProgressBar value={p.percentage} label={dict.portal.progress} />
                        </div>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        {s.lastLesson}: {e.last_lesson ? tr(e.last_lesson.title, locale) : "—"} · {s.examBest}: {best.has(e.course_id) ? `${best.get(e.course_id)}%` : "—"}
                      </p>
                      {e.status !== "pending" && e.status !== "cancelled" ? <EnrollmentActions enrollmentId={e.id} status={live ? "active" : e.status === "active" ? "expired" : e.status} userId={id} courseId={e.course_id} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={s.manualEnroll} />
            <CardBody>
              <ManualEnrollForm
                studentId={id}
                defaultDays={settings.default_access_days}
                courses={((courses ?? []) as unknown as { id: string; status: string; course_translations: Tr }[]).map((c) => ({ id: c.id, title: `${titleOf(c.course_translations, locale)}${c.status === "draft" ? ` (${dict.courseStatus.draft})` : ""}` }))}
                methods={((methods ?? []) as { id: string; name: Localized }[]).map((m) => ({ id: m.id, name: tr(m.name, locale) }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={s.paymentHistory} />
            <Table>
              <thead className="bg-slate-50"><tr><Th>{dict.admin.payments.course}</Th><Th>{dict.common.amount}</Th><Th>{dict.admin.payments.reference}</Th><Th>{dict.admin.payments.submitted}</Th><Th>{dict.common.status}</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(payments ?? []).length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-slate-500">{dict.common.noResults}</Td></tr> : ((payments ?? []) as unknown as { id: string; amount: number; currency: string; status: "pending"; submitted_at: string; reference: string | null; course: { course_translations: Tr } | null }[]).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td><Link href={`/${locale}/admin/payments/${p.id}`} className="text-sm font-medium hover:text-brand-700">{titleOf(p.course?.course_translations, locale)}</Link></Td>
                    <Td className="whitespace-nowrap text-sm">{formatMoney(p.amount, p.currency, locale)}</Td>
                    <Td className="font-mono text-xs">{p.reference || "—"}</Td>
                    <Td className="whitespace-nowrap text-sm">{formatDate(p.submitted_at, locale, true)}</Td>
                    <Td><Badge tone={statusTone[p.status]}>{dict.paymentStatus[p.status]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={s.profile} />
            <CardBody>
              <DefinitionList items={[
                [s.email, profile.email],
                [s.phone, profile.phone || "—"],
                [s.country, countryName(profile.country, locale)],
                [dict.nav.language, profile.preferred_locale.toUpperCase()],
                [s.registered, formatDate(profile.created_at, locale)],
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={dict.common.actions} />
            <CardBody><AccountActions userId={id} email={profile.email} status={profile.status} role={profile.role} isSelf={me.user.id === id} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={s.certificates} />
            <CardBody>
              {(certs ?? []).length === 0 ? <p className="text-sm text-slate-500">{dict.common.none}</p> : (
                <ul className="space-y-2">
                  {((certs ?? []) as { id: string; code: string; status: "valid"; issued_at: string; course_title: Localized }[]).map((c) => (
                    <li key={c.id} className="text-sm">
                      <a href={`/api/certificates/${c.code}/pdf`} target="_blank" rel="noopener" className="font-medium text-slate-900 hover:text-brand-700">{tr(c.course_title, locale)}</a>
                      <p className="flex items-center gap-2 text-xs text-slate-500"><span className="font-mono">{c.code}</span><Badge tone={statusTone[c.status]}>{dict.certificateStatus[c.status]}</Badge></p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
