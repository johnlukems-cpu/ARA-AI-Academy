import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageHandledButton } from "@/components/admin/admin-forms";

export default async function AdminMessages({ params }: PageProps<"/[locale]/admin/messages">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const m = dict.admin.messages;
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages").select("*").order("handled_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; name: string; email: string; phone: string | null; subject: string | null; message: string; locale: string; handled_at: string | null; created_at: string }[];
  return (
    <>
      <PageHeader title={m.title} />
      {rows.length === 0 ? <EmptyState icon={<Mail className="size-8" />} title={m.empty} /> : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id} className={r.handled_at ? "opacity-70" : undefined}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{r.subject || "—"}</p>
                    <p className="text-sm text-slate-600">{r.name} · {formatDate(r.created_at, locale, true)} · {r.locale.toUpperCase()}</p>
                  </div>
                  {r.handled_at ? <Badge tone="success">{m.handled}</Badge> : <MessageHandledButton id={r.id} />}
                </div>
                <p className="whitespace-pre-line text-sm text-slate-800">{r.message}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><Mail className="size-4" />{r.email}</a>
                  {r.phone ? <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><Phone className="size-4" />{r.phone}</a> : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
