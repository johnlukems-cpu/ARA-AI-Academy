import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Th, Td } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";

const PAGE = 100;

export default async function AdminAudit({ params, searchParams }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.audit;
  const sp = await searchParams;
  const page = Math.max(0, Math.min(1000, Number(typeof sp.page === "string" ? sp.page : 0) || 0));
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, details, ip, created_at, actor:profiles(first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  const rows = (data ?? []) as unknown as { id: number; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; ip: string | null; created_at: string; actor: { first_name: string; last_name: string; email: string } | null }[];
  return (
    <>
      <PageHeader title={a.title} />
      <Card>
        <Table>
          <thead className="bg-slate-50"><tr><Th>{dict.common.date}</Th><Th>{a.actor}</Th><Th>{a.action}</Th><Th>{a.entity}</Th><Th>{a.details}</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><Td colSpan={5} className="py-8 text-center text-slate-500">{dict.common.noResults}</Td></tr> : rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">{formatDate(r.created_at, locale, true)}</Td>
                <Td className="text-sm">{r.actor ? `${r.actor.first_name} ${r.actor.last_name}`.trim() || r.actor.email : a.system}</Td>
                <Td className="font-mono text-xs">{r.action}</Td>
                <Td className="text-xs"><span className="text-slate-500">{r.entity_type}</span> <span className="font-mono">{r.entity_id?.slice(0, 8)}</span></Td>
                <Td className="max-w-md truncate font-mono text-xs text-slate-500" >{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={`?page=${page - 1}`} className="font-medium text-brand-700">← {dict.common.previous}</Link> : <span />}
        {rows.length === PAGE ? <Link href={`?page=${page + 1}`} className="font-medium text-brand-700">{dict.common.next} →</Link> : null}
      </div>
    </>
  );
}
