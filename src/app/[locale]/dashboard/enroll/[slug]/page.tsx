import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Hourglass, XCircle } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { courseText, getActivePaymentMethods, getCourseOutline, getSettings } from "@/lib/data/catalog";
import { formatMoney, formatDate } from "@/lib/format";
import type { Enrollment } from "@/lib/types";
import { PageHeader, DefinitionList } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PaymentForm } from "@/components/student/payment-form";
import { RequestEnrollmentButton, CancelEnrollmentButton } from "@/components/student/enroll-buttons";

export default async function EnrollPage({ params }: PageProps<"/[locale]/dashboard/enroll/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const e = dict.enroll;
  const { user } = await requireUser(locale);
  const course = await getCourseOutline(slug);
  if (!course) notFound();
  const t = courseText(course, locale);
  const supabase = await createClient();
  const [{ data: enrollment }, methods, settings] = await Promise.all([
    supabase.from("enrollments").select("*").eq("course_id", course.id).eq("student_id", user.id).in("status", ["pending", "active"]).maybeSingle<Enrollment>(),
    getActivePaymentMethods(),
    getSettings(),
  ]);
  const { data: payments } = enrollment
    ? await supabase.from("payments").select("id, status, rejection_reason, submitted_at").eq("enrollment_id", enrollment.id).order("submitted_at", { ascending: false })
    : { data: [] as { id: string; status: string; rejection_reason: string | null; submitted_at: string }[] };
  const latest = payments?.[0];
  const amount = Number(course.price) > 0 ? formatMoney(course.price, course.currency, locale) : dict.common.priceOnRequest;
  const open = course.status === "published" && course.enrollment_open && settings.enrollment_open;

  return (
    <>
      <PageHeader title={e.title} description={t.title} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!enrollment ? (
            <Card>
              <CardHeader title={e.stepsTitle} />
              <CardBody>
                <ol className="space-y-3">
                  {e.steps.map((s, i) => (
                    <li key={s} className="flex gap-3 text-sm text-slate-700">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  {open ? <RequestEnrollmentButton courseId={course.id} /> : <Alert tone="warning">{e.enrollmentClosed}</Alert>}
                </div>
              </CardBody>
            </Card>
          ) : enrollment.status === "active" ? (
            <Card>
              <CardBody className="flex flex-col items-start gap-4">
                <Alert tone="success" title={e.active}>{fmt(dict.portal.expiresOn, { date: formatDate(enrollment.expires_at, locale) })}</Alert>
                <ButtonLink href={`/${locale}/dashboard/courses/${course.slug}`}>{dict.course.goToCourse}</ButtonLink>
              </CardBody>
            </Card>
          ) : latest?.status === "pending" ? (
            <Card>
              <CardBody className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Hourglass className="size-6" /></span>
                <div>
                  <p className="font-semibold text-slate-900">{dict.portal.awaitingReview}</p>
                  <p className="mt-1 text-sm text-slate-600">{e.underReview}</p>
                  <p className="mt-2 text-xs text-slate-500">{dict.payments.submitted}: {formatDate(latest.submitted_at, locale, true)}</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title={e.paymentFormTitle} />
              <CardBody>
                {latest?.status === "rejected" ? (
                  <Alert tone="error" title={e.rejectedTitle} className="mb-6">
                    {latest.rejection_reason ? fmt(e.rejectedReason, { reason: latest.rejection_reason }) : null} {e.resubmit}
                  </Alert>
                ) : null}
                <PaymentForm enrollmentId={enrollment.id} methods={methods} amountLabel={amount} />
              </CardBody>
            </Card>
          )}
          {payments && payments.length > 0 ? (
            <Card>
              <CardHeader title={dict.payments.title} />
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm sm:px-6">
                    {p.status === "approved" ? <CheckCircle2 className="size-4 text-emerald-500" /> : p.status === "rejected" ? <XCircle className="size-4 text-rose-500" /> : <Clock className="size-4 text-amber-500" />}
                    <span className="flex-1">{formatDate(p.submitted_at, locale, true)}</span>
                    <span className="font-medium">{dict.paymentStatus[p.status as "pending"]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
        <aside>
          <Card>
            <CardHeader title={e.summary} />
            <CardBody>
              <DefinitionList
                items={[
                  [e.course, t.title],
                  [e.price, amount],
                  [e.access, fmt(dict.course.accessValue, { days: course.access_days })],
                  [dict.common.status, enrollment ? dict.enrollmentStatus[enrollment.status] : "—"],
                ]}
              />
              {enrollment?.status === "pending" && latest?.status !== "pending" ? (
                <div className="mt-4 border-t border-slate-100 pt-4"><CancelEnrollmentButton enrollmentId={enrollment.id} /></div>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
