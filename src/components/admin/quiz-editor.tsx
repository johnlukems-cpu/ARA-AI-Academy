"use client";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { saveQuiz, saveQuestion, deleteQuestion } from "@/app/actions/courses";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { ActionButton, BiField } from "./builder";

type L = Partial<Record<string, string>> | null | undefined;
type QType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export type QuizSettingsValue = {
  id: string; kind: string; status: string; title: L; instructions: L; passing_score: number; time_limit_minutes: number | null; max_attempts: number | null;
  question_count: number | null; retake_wait_hours: number; shuffle_questions: boolean; show_correct_answers: boolean;
};

export function QuizSettingsForm({ value }: { value: QuizSettingsValue }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.quizzes;
  return (
    <ActionForm action={saveQuiz} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={value.id} />
      <BiField name="title" label={dict.admin.lessons.title} value={value.title} required maxLength={200} />
      <BiField name="instructions" label={dict.quiz.instructions} value={value.instructions} multiline rows={3} maxLength={5000} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={a.passingScore} htmlFor="passing_score"><Input id="passing_score" name="passing_score" type="number" min={1} max={100} defaultValue={value.passing_score} required /></Field>
        <Field label={a.timeLimit} htmlFor="time_limit_minutes"><Input id="time_limit_minutes" name="time_limit_minutes" type="number" min={1} max={600} defaultValue={value.time_limit_minutes ?? ""} /></Field>
        <Field label={a.maxAttempts} htmlFor="max_attempts"><Input id="max_attempts" name="max_attempts" type="number" min={1} max={100} defaultValue={value.max_attempts ?? ""} /></Field>
        <Field label={a.questionCount} htmlFor="question_count"><Input id="question_count" name="question_count" type="number" min={1} max={500} defaultValue={value.question_count ?? ""} /></Field>
        <Field label={a.retakeWait} htmlFor="retake_wait_hours"><Input id="retake_wait_hours" name="retake_wait_hours" type="number" min={0} max={8760} defaultValue={value.retake_wait_hours} /></Field>
        <Field label={a.status} htmlFor="status" hint={a.publishHint}>
          <Select id="status" name="status" defaultValue={value.status}>
            <option value="draft">{dict.courseStatus.draft}</option>
            <option value="published">{dict.courseStatus.published}</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="shuffle_questions" label={a.shuffle} defaultChecked={value.shuffle_questions} />
        <Checkbox name="show_correct_answers" label={a.showAnswers} defaultChecked={value.show_correct_answers} />
      </div>
      <SubmitButton>{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}

export type QuestionValue = {
  id?: string; type: QType; prompt: L; explanation: L; points: number; accepted_answers: Partial<Record<string, string[]>>;
  options: { id?: string; label: L; is_correct: boolean }[];
};

type Opt = { key: string; id?: string; nl: string; en: string; is_correct: boolean };
let seq = 0;
const newKey = () => `o${++seq}`;

function defaultOptions(type: QType, trueLabel: { nl: string; en: string }, falseLabel: { nl: string; en: string }): Opt[] {
  if (type === "true_false") {
    return [
      { key: newKey(), nl: trueLabel.nl, en: trueLabel.en, is_correct: true },
      { key: newKey(), nl: falseLabel.nl, en: falseLabel.en, is_correct: false },
    ];
  }
  return [
    { key: newKey(), nl: "", en: "", is_correct: true },
    { key: newKey(), nl: "", en: "", is_correct: false },
  ];
}

export function QuestionEditor({ quizId, value, onDone }: { quizId: string; value?: QuestionValue; onDone?: () => void }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.quizzes;
  const c = dict.admin.courses;
  const [type, setType] = useState<QType>(value?.type ?? "single_choice");
  const [opts, setOpts] = useState<Opt[]>(() =>
    value?.options.length
      ? value.options.map((o) => ({ key: newKey(), id: o.id, nl: o.label?.nl ?? "", en: o.label?.en ?? "", is_correct: o.is_correct }))
      : defaultOptions("single_choice", { nl: "Waar", en: "True" }, { nl: "Onwaar", en: "False" }),
  );
  const single = type !== "multiple_choice";

  function changeType(t: QType) {
    setType(t);
    if (t === "true_false") {
      setOpts(defaultOptions(t, { nl: "Waar", en: "True" }, { nl: "Onwaar", en: "False" }));
    } else if (t === "single_choice") {
      // Single choice: keep only the first correct option marked.
      setOpts((o) => {
        let seen = false;
        return o.map((x) => {
          const keep = x.is_correct && !seen;
          if (x.is_correct) seen = true;
          return { ...x, is_correct: keep };
        });
      });
    }
  }
  const update = (key: string, patch: Partial<Opt>) => setOpts((o) => o.map((x) => (x.key === key ? { ...x, ...patch } : single && patch.is_correct ? { ...x, is_correct: false } : x)));
  const payload = JSON.stringify(opts.map((o) => ({ ...(o.id ? { id: o.id } : {}), label: { nl: o.nl, en: o.en }, is_correct: o.is_correct })));

  return (
    <ActionForm action={saveQuestion} className="space-y-4" onSuccess={onDone} resetOnSuccess={!value}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="quiz_id" value={quizId} />
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <input type="hidden" name="options" value={type === "short_answer" ? "[]" : payload} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={a.type} htmlFor={`qt-${value?.id ?? "new"}`}>
          <Select id={`qt-${value?.id ?? "new"}`} name="type" value={type} onChange={(e) => changeType(e.target.value as QType)}>
            {(["single_choice", "multiple_choice", "true_false", "short_answer"] as const).map((t) => <option key={t} value={t}>{dict.questionTypes[t]}</option>)}
          </Select>
        </Field>
        <Field label={a.points} htmlFor={`qp-${value?.id ?? "new"}`}><Input id={`qp-${value?.id ?? "new"}`} name="points" type="number" min={0.5} max={100} step="0.5" defaultValue={value?.points ?? 1} /></Field>
      </div>
      <BiField name="prompt" label={a.prompt} value={value?.prompt} multiline rows={2} required maxLength={2000} />

      {type === "short_answer" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(["nl", "en"] as const).map((l) => (
            <Field key={l} label={`${a.acceptedAnswers} · ${l === "nl" ? c.dutch : c.english}`} htmlFor={`acc-${l}-${value?.id ?? "new"}`}>
              <Textarea id={`acc-${l}-${value?.id ?? "new"}`} name={`accepted_${l}`} rows={3} defaultValue={(value?.accepted_answers?.[l] ?? []).join("\n")} />
            </Field>
          ))}
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">{a.options}</legend>
          {opts.map((o, i) => (
            <div key={o.key} className="grid items-center gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200 sm:grid-cols-[auto_1fr_1fr_auto]">
              <label className="flex items-center gap-2 px-1 text-xs font-medium text-slate-600">
                <input type={single ? "radio" : "checkbox"} name={`correct-${value?.id ?? "new"}`} checked={o.is_correct} onChange={(e) => update(o.key, { is_correct: e.target.checked })} className="size-4 accent-emerald-600" />
                {a.correct}
              </label>
              <Input aria-label={`${a.optionLabel} ${i + 1} · ${c.dutch}`} placeholder={`${a.optionLabel} ${i + 1} (NL)`} value={o.nl} onChange={(e) => update(o.key, { nl: e.target.value })} maxLength={500} />
              <Input aria-label={`${a.optionLabel} ${i + 1} · ${c.english}`} placeholder={`${a.optionLabel} ${i + 1} (EN)`} value={o.en} onChange={(e) => update(o.key, { en: e.target.value })} maxLength={500} />
              {type !== "true_false" && opts.length > 2 ? (
                <button type="button" onClick={() => setOpts((x) => x.filter((y) => y.key !== o.key))} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600" aria-label={dict.common.delete}><X className="size-4" /></button>
              ) : <span />}
            </div>
          ))}
          {type !== "true_false" && opts.length < 10 ? (
            <button type="button" onClick={() => setOpts((x) => [...x, { key: newKey(), nl: "", en: "", is_correct: false }])} className={buttonClass("ghost", "sm")}>
              <Plus className="size-4" />{a.addOption}
            </button>
          ) : null}
        </fieldset>
      )}
      <BiField name="explanation" label={a.explanation} value={value?.explanation} multiline rows={2} maxLength={2000} />
      <SubmitButton size="sm">{value?.id ? dict.common.save : a.addQuestion}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteQuestionButton({ id }: { id: string }) {
  const { dict } = useI18n();
  return <ActionButton action={deleteQuestion} fields={{ id }} variant="ghost" confirm={`${dict.admin.quizzes.deleteQuestion}?`}><Trash2 className="size-4" /><span className="sr-only">{dict.admin.quizzes.deleteQuestion}</span></ActionButton>;
}
