import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

export default async function AdminStudents({ params, searchParams }: PageProps<"/[locale]/admin/students">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const s = dict.admin.students;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, country, role, status, created_at, enrollments(status)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    // Strip characters that have meaning in PostgREST filter syntax.
    const term = q.replace(/[,()*%\\]/g, " ").trim();
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as { id: string; first_name: string; last_name: string; email: string; phone: string | null; country: string; role: "student" | "admin"; status: "active" | "suspended"; created_at: string; enrollments: { status: string }[] }[];
  return (
    <>
      <PageHeader title={s.title} />
      <form className="mb-4 flex max-w-xl gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={s.search} aria-label={s.search} />
        <button type="submit" className={buttonClass("secondary", "md")}><Search className="size-4" /><span className="sr-only">{dict.common.search}</span></button>
      </form>
      <Card>
        <Table>
          <thead className="bg-slate-50"><tr><Th>{s.name}</Th><Th>{s.phone}</Th><Th>{s.country}</Th><Th>{s.enrollments}</Th><Th>{s.registered}</Th><Th>{dict.common.status}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={6} className="py-8 text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/${locale}/admin/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{`${r.first_name} ${r.last_name}`.trim() || r.email}</Link>
                  <p className="text-xs text-slate-500">{r.email}</p>
                </Td>
                <Td className="text-sm">{r.phone || "—"}</Td>
                <Td className="text-sm">{r.country}</Td>
                <Td className="text-sm">{r.enrollments.filter((e) => e.status === "active").length} / {r.enrollments.length}</Td>
                <Td className="whitespace-nowrap text-sm">{formatDate(r.created_at, locale)}</Td>
                <Td className="space-x-1">
                  <Badge tone={statusTone[r.status]}>{dict.accountStatus[r.status]}</Badge>
                  {r.role === "admin" ? <Badge tone="brand">{dict.roles.admin}</Badge> : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
