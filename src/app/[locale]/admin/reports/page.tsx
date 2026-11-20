import { notFound } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { reportTypes } from "@/lib/reports";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

export default async function AdminReports({ params, searchParams }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const r = dict.admin.reports;
  const sp = await searchParams;
  const valid = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = new Date().toISOString().slice(0, 10);
  const from = valid(sp.from) ? (sp.from as string) : `${today.slice(0, 4)}-01-01`;
  const to = valid(sp.to) ? (sp.to as string) : today;
  const qs = (type: string, format: string) => `/api/reports/${type}?format=${format}&locale=${locale}&from=${from}&to=${to}`;
  return (
    <>
      <PageHeader title={r.title} description={r.intro} />
      <Card className="mb-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3">
            <Field label={r.from} htmlFor="from"><Input id="from" name="from" type="date" defaultValue={from} max={today} /></Field>
            <Field label={r.to} htmlFor="to"><Input id="to" name="to" type="date" defaultValue={to} max={today} /></Field>
            <button type="submit" className={buttonClass("secondary", "md")}>{dict.common.filter}</button>
          </form>
        </CardBody>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map((t) => (
          <Card key={t}>
            <CardBody className="flex h-full flex-col justify-between gap-4">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><FileSpreadsheet className="size-5 text-brand-600" />{r.types[t]}</p>
              <div className="flex gap-2">
                <a href={qs(t, "csv")} className={buttonClass("primary", "sm")}><Download className="size-4" />{r.csv}</a>
                <a href={qs(t, "pdf")} className={buttonClass("secondary", "sm")}><Download className="size-4" />{r.pdf}</a>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
