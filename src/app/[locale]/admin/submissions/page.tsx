import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { tr, type Localized } from "@/lib/localize";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { SubmissionReviewForm } from "@/components/admin/admin-forms";

const filters = ["submitted", "needs_revision", "approved"] as const;

export default async function AdminSubmissions({ params, searchParams }: PageProps<"/[locale]/admin/submissions">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const a = dict.admin.submissions;
  const { status } = await searchParams;
  const active = typeof status === "string" && (filters as readonly string[]).includes(status) ? (status as (typeof filters)[number]) : "submitted";
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_submissions")
    .select("id, student_id, status, text_answer, link_url, storage_path, file_name, score, feedback, submitted_at, reviewed_at, student:profiles!assignment_submissions_student_id_fkey(first_name, last_name, email), assignment:assignments(max_score, lesson:lessons(title), course:courses(course_translations(locale, title)))")
    .eq("status", active)
    .order("submitted_at", { ascending: active === "submitted" })
    .limit(100);
  const rows = (data ?? []) as unknown as {
    id: string; student_id: string; status: (typeof filters)[number]; text_answer: string | null; link_url: string | null; storage_path: string | null; file_name: string | null; score: number | null; feedback: string | null; submitted_at: string;
    student: { first_name: string; last_name: string; email: string } | null;
    assignment: { max_score: number; lesson: { title: Localized } | null; course: { course_translations: { locale: string; title: string }[] } | null } | null;
  }[];
  const base = `/${locale}/admin/submissions`;
  return (
    <>
      <PageHeader title={a.title} />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((s) => (
          <Link key={s} href={`${base}?status=${s}`} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium ring-1", active === s ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>
            {dict.submissionStatus[s]}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState title={a.empty} /> : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{tr(r.assignment?.lesson?.title, locale)}</p>
                    <p className="text-sm text-slate-600">
                      <Link href={`/${locale}/admin/students/${r.student_id}`} className="font-medium hover:text-brand-700">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</Link>
                      {" · "}{r.assignment?.course?.course_translations.find((t) => t.locale === locale)?.title}
                    </p>
                    <p className="text-xs text-slate-500">{a.submitted}: {formatDate(r.submitted_at, locale, true)}</p>
                  </div>
                  <Badge tone={statusTone[r.status]}>{dict.submissionStatus[r.status]}</Badge>
                </div>
                {r.text_answer ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{a.answer}</p>
                    <p className="max-h-80 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-slate-200">{r.text_answer}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-4 text-sm">
                  {r.link_url ? <a href={r.link_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"><ExternalLink className="size-4" />{a.link}</a> : null}
                  {r.storage_path ? <a href={`/api/files/submission/${r.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"><FileText className="size-4" />{r.file_name ?? a.file}</a> : null}
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <SubmissionReviewForm submissionId={r.id} maxScore={r.assignment?.max_score ?? 100} score={r.score} feedback={r.feedback} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
