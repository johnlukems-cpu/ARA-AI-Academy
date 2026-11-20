"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { finishQuiz } from "@/app/actions/learning";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { Localized } from "@/lib/localize";

type Q = { id: string; type: "single_choice" | "multiple_choice" | "true_false" | "short_answer"; prompt: Localized; points: number; options: { id: string; label: Localized }[] };
type Answers = Record<string, string | string[]>;

const pick = (v: Localized, locale: string) => v?.[locale] || v?.nl || v?.en || "";

function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

export function QuizRunner({ attemptId, questions, remainingMs }: { attemptId: string; questions: Q[]; remainingMs: number | null }) {
  const { locale, dict } = useI18n();
  const q = dict.quiz;
  const router = useRouter();
  const storageKey = `ara-quiz-${attemptId}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState<number | null>(remainingMs);
  const submitted = useRef(false);

  // Restore draft answers (per-device convenience only; the server is the source of truth).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after hydration
      if (raw) setAnswers(JSON.parse(raw) as Answers);
    } catch { /* storage unavailable */ }
  }, [storageKey]);
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, storageKey]);

  const submit = useCallback((auto = false) => {
    if (submitted.current) return;
    if (!auto && !window.confirm(q.confirmSubmit)) return;
    submitted.current = true;
    setError(null);
    startTransition(async () => {
      const res = await finishQuiz({ attemptId, answers, locale });
      if (!res.ok) {
        submitted.current = false;
        setError(res.error);
        return;
      }
      try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
      router.refresh();
    });
  }, [answers, attemptId, locale, q.confirmSubmit, router, storageKey]);

  // Countdown with automatic submission when time runs out.
  useEffect(() => {
    if (remainingMs === null) return;
    const end = Date.now() + remainingMs;
    const t = window.setInterval(() => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        window.clearInterval(t);
        submit(true);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [remainingMs, submit]);

  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggle = (id: string, opt: string) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  const isAnswered = (id: string) => {
    const v = answers[id];
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
  };
  const open = questions.filter((x) => !isAnswered(x.id)).length;
  const timeUp = left !== null && left <= 0;

  return (
    <div className="space-y-5">
      {left !== null ? (
        <div className={cn("sticky top-16 z-20 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold shadow-card ring-1", left < 60_000 ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-white text-slate-800 ring-slate-200")} role="timer" aria-live="off">
          <span className="flex items-center gap-2"><Clock className="size-4" />{q.timeRemaining}</span>
          <span className="font-mono text-base tabular-nums">{formatClock(left)}</span>
        </div>
      ) : null}
      {timeUp ? <Alert tone="warning">{q.timeUp}</Alert> : null}

      {questions.map((question, i) => {
        const name = `q-${question.id}`;
        return (
          <fieldset key={question.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 sm:p-6" disabled={pending || timeUp}>
            <legend className="sr-only">{fmt(q.question, { n: i + 1, total: questions.length })}</legend>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{fmt(q.question, { n: i + 1, total: questions.length })}</p>
            <p className="mt-1.5 font-medium whitespace-pre-line text-slate-900">{pick(question.prompt, locale)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {question.type === "multiple_choice" ? q.selectMultiple : question.type === "short_answer" ? q.typeAnswer : q.selectOne}
            </p>
            <div className="mt-4 space-y-2">
              {question.type === "short_answer" ? (
                <input
                  type="text"
                  maxLength={500}
                  value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""}
                  onChange={(e) => set(question.id, e.target.value)}
                  aria-label={q.typeAnswer}
                  className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
              ) : (
                question.options.map((o) => {
                  const multi = question.type === "multiple_choice";
                  const checked = multi ? (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(o.id)) : answers[question.id] === o.id;
                  return (
                    <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors", checked ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 hover:border-slate-300")}>
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={name}
                        checked={checked}
                        onChange={() => (multi ? toggle(question.id, o.id) : set(question.id, o.id))}
                        className="mt-0.5 size-4 accent-brand-600"
                      />
                      <span>{pick(o.label, locale)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </fieldset>
        );
      })}

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
        <p className="text-sm text-slate-600">{open > 0 ? fmt(q.unanswered, { n: open }) : null}</p>
        <button type="button" onClick={() => submit(false)} disabled={pending || timeUp} className={buttonClass("primary", "md")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {q.submit}
        </button>
      </div>
    </div>
  );
}
