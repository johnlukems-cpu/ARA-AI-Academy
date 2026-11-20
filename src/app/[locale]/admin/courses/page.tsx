import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export default async function AdminCourses({ params }: PageProps<"/[locale]/admin/courses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const c = dict.admin.courses;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, slug, status, price, currency, sort_order, course_translations(locale, title), lessons(id, status), enrollments(id, status)")
    .order("sort_order")
    .order("created_at");
  const rows = (data ?? []) as unknown as { id: string; slug: string; status: "draft"; price: number; currency: string; course_translations: { locale: string; title: string }[]; lessons: { status: string }[]; enrollments: { status: string }[] }[];
  return (
    <>
      <PageHeader title={c.title} actions={<ButtonLink href={`/${locale}/admin/courses/new`}><Plus className="size-4" />{c.new}</ButtonLink>} />
      <Card>
        <Table>
          <thead className="bg-slate-50"><tr><Th>{c.titleField}</Th><Th>{c.status}</Th><Th>{c.price}</Th><Th>{c.lessonsCount}</Th><Th>{c.enrollmentsCount}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={5} className="py-8 text-center text-slate-500">{c.noCourses}</Td></tr> : rows.map((r) => {
              const title = r.course_translations.find((t) => t.locale === locale)?.title ?? r.course_translations[0]?.title ?? r.slug;
              const published = r.lessons.filter((l) => l.status === "published").length;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/${locale}/admin/courses/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{title}</Link>
                    <p className="font-mono text-xs text-slate-400">/{r.slug}</p>
                  </Td>
                  <Td><Badge tone={statusTone[r.status]}>{dict.courseStatus[r.status]}</Badge></Td>
                  <Td className="whitespace-nowrap">{formatMoney(r.price, r.currency, locale)}</Td>
                  <Td className="text-sm text-slate-600">{published}/{r.lessons.length}</Td>
                  <Td className="text-sm text-slate-600">{r.enrollments.filter((e) => e.status === "active").length} / {r.enrollments.length}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
