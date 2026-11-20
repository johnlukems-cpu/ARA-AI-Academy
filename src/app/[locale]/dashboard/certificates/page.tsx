import { notFound } from "next/navigation";
import { Award, Download, ShieldCheck } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tr, type Localized } from "@/lib/localize";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";

export default async function MyCertificates({ params }: PageProps<"/[locale]/dashboard/certificates">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const c = dict.certificates;
  const { user } = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select("code, course_title, recipient_name, completion_date, issued_at")
    .eq("student_id", user.id)
    .eq("status", "valid")
    .order("issued_at", { ascending: false });
  const rows = (data ?? []) as { code: string; course_title: Localized; recipient_name: string; completion_date: string; issued_at: string }[];
  return (
    <>
      <PageHeader title={c.title} />
      {rows.length === 0 ? (
        <EmptyState icon={<Award className="size-8" />} title={c.empty} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.code} className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-brand-600 via-accent-500 to-gold-400" />
              <CardBody>
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Award className="size-6" /></span>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900">{tr(r.course_title, locale)}</h2>
                    <p className="text-sm text-slate-600">{r.recipient_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{fmt(c.issued, { date: formatDate(r.completion_date, locale) })}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{c.code}: {r.code}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={`/api/certificates/${r.code}/pdf?lang=${locale}&download=1`} className={buttonClass("primary", "sm")}><Download className="size-4" />{c.download}</a>
                  <ButtonLink href={`/${locale}/verify/${r.code}`} size="sm" variant="secondary"><ShieldCheck className="size-4" />{c.verifyLink}</ButtonLink>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
