import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell } from "lucide-react";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/student/mark-read";

type N = { id: string; type: string; payload: Record<string, string | number>; link: string | null; read_at: string | null; created_at: string };

export default async function NotificationsPage({ params }: PageProps<"/[locale]/dashboard/notifications">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { user } = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as N[];
  const courseIds = [...new Set(rows.map((r) => r.payload?.course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("id, slug, course_translations(locale, title)").in("id", courseIds)
    : { data: [] as { id: string; slug: string; course_translations: { locale: string; title: string }[] }[] };
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
  const types = dict.notifications.types as Record<string, string>;
  return (
    <>
      <PageHeader title={dict.notifications.title} actions={rows.some((r) => !r.read_at) ? <MarkAllReadButton /> : null} />
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" />} title={dict.notifications.empty} />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => {
              const course = courseMap.get(String(n.payload?.course_id ?? ""));
              const title = course?.course_translations.find((t) => t.locale === locale)?.title ?? course?.course_translations[0]?.title ?? "";
              const text = fmt(types[n.type] ?? n.type, { course: title, days: n.payload?.days });
              const href = n.type === "certificate_issued" ? `/${locale}/dashboard/certificates` : course ? (n.type.startsWith("payment") || n.type === "enrollment_submitted" ? `/${locale}/dashboard/enroll/${course.slug}` : `/${locale}/dashboard/courses/${course.slug}`) : null;
              const body = (
                <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-slate-200" : "bg-accent-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read_at ? "text-slate-600" : "font-medium text-slate-900"}`}>{text}</p>
                    {n.payload?.reason ? <p className="mt-0.5 text-xs text-slate-500">{String(n.payload.reason)}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">{formatDate(n.created_at, locale, true)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{href ? <Link href={href} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
