import { ShieldCheck, ShieldAlert, SearchX } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { formatDate } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { DefinitionList } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";

type Row = { code: string; recipient_name: string; course_title: Localized; completion_date: string; issued_at: string; status: "valid" | "revoked"; revoked_at: string | null };

export async function VerifyResult({ code, locale }: { code: string; locale: Locale }) {
  const dict = getDictionary(locale);
  const v = dict.verify;
  if (!isSupabaseConfigured()) return <Alert tone="warning">{dict.common.notConfigured}</Alert>;
  if (!(await rateLimit("verify", 30, 60))) return <Alert tone="error">{dict.errors.rateLimited}</Alert>;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { p_code: code.slice(0, 40) });
  const row = (data as Row[] | null)?.[0];
  if (!row) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-slate-200/70">
        <SearchX className="mx-auto size-10 text-slate-400" />
        <h2 className="mt-3 text-xl font-bold">{v.notFoundTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{v.notFoundText}</p>
      </div>
    );
  }
  const valid = row.status === "valid";
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 ${valid ? "ring-emerald-200" : "ring-rose-200"}`}>
      <div className={`flex items-center gap-3 px-6 py-4 ${valid ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
        {valid ? <ShieldCheck className="size-7" /> : <ShieldAlert className="size-7" />}
        <h2 className="text-lg font-bold">{valid ? v.validTitle : v.revokedTitle}</h2>
      </div>
      <div className="px-6 py-4">
        <DefinitionList
          items={[
            [v.recipient, row.recipient_name],
            [v.course, tr(row.course_title, locale)],
            [v.completed, formatDate(row.completion_date, locale)],
            [v.issued, formatDate(row.issued_at, locale)],
            [v.certificateId, <span key="c" className="font-mono">{row.code}</span>],
            ...(row.revoked_at ? ([[v.revokedOn, formatDate(row.revoked_at, locale)]] as [string, string][]) : []),
          ]}
        />
        <p className="mt-4 text-xs text-slate-500">{v.disclaimer}</p>
      </div>
    </div>
  );
}
