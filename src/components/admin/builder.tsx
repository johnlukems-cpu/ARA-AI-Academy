"use client";
import { startTransition, useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/i18n/client";
import {
  moveItem, saveModule, deleteModule, createLesson, saveCourse, setCourseStatus, deleteCourse, setCourseImage,
  createFinalExam, addResource, deleteResource, saveAssignmentSettings, saveLesson, deleteLesson,
} from "@/app/actions/courses";
import { uploadFile } from "@/components/forms/upload";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { ActionResult } from "@/lib/errors";

type Action = (s: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type L = Partial<Record<string, string>> | null | undefined;
const LOCALES = ["nl", "en"] as const;

/** A one-button form posting hidden fields to a server action. Errors appear inline. */
export function ActionButton({ action, fields, children, variant = "secondary", size = "sm", confirm, className, title }: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
  title?: string;
}) {
  const { locale } = useI18n();
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("inline-flex flex-col", className)} title={title}>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} confirm={confirm}>{children}</SubmitButton>
      {state && !state.ok ? <span className="mt-1 max-w-xs text-xs text-rose-600">{state.error}</span> : null}
    </form>
  );
}

export function MoveButtons({ kind, id, first, last }: { kind: "module" | "lesson" | "question" | "resource"; id: string; first: boolean; last: boolean }) {
  const { dict } = useI18n();
  const c = dict.admin.courses;
  return (
    <span className="inline-flex gap-1">
      {!first ? <ActionButton action={moveItem} fields={{ kind, id, dir: "up" }} variant="ghost" title={c.moveUp}><ArrowUp className="size-4" /><span className="sr-only">{c.moveUp}</span></ActionButton> : null}
      {!last ? <ActionButton action={moveItem} fields={{ kind, id, dir: "down" }} variant="ghost" title={c.moveDown}><ArrowDown className="size-4" /><span className="sr-only">{c.moveDown}</span></ActionButton> : null}
    </span>
  );
}

/** Side-by-side NL/EN inputs named `${name}_nl` / `${name}_en`. */
export function BiField({ name, label, value, multiline, rows = 3, required, maxLength, hint }: {
  name: string; label: string; value?: L; multiline?: boolean; rows?: number; required?: boolean; maxLength?: number; hint?: string;
}) {
  const { dict } = useI18n();
  const c = dict.admin.courses;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {LOCALES.map((l) => (
        <Field key={l} label={`${label} · ${l === "nl" ? c.dutch : c.english}`} htmlFor={`${name}_${l}`} required={required} hint={l === "nl" ? hint : undefined}>
          {multiline ? (
            <Textarea id={`${name}_${l}`} name={`${name}_${l}`} rows={rows} defaultValue={value?.[l] ?? ""} maxLength={maxLength} className="font-mono text-sm" />
          ) : (
            <Input id={`${name}_${l}`} name={`${name}_${l}`} defaultValue={value?.[l] ?? ""} maxLength={maxLength} />
          )}
        </Field>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------
type Translation = { locale: string; title: string; subtitle: string | null; description: string | null; objectives: string[]; target_audience: string | null; certificate_requirements: string | null };
export type CourseFormValue = {
  id?: string; slug: string; level: string; price: number; currency: string; access_days: number; duration_weeks: number | null; estimated_hours: number | null;
  sort_order: number; is_featured: boolean; enrollment_open: boolean; require_all_mandatory_lessons: boolean; require_assignments: boolean; require_final_exam: boolean;
  certificate_enabled: boolean; delivery_locales: string[]; translations: Translation[];
};

export function CourseForm({ value, currencies }: { value: CourseFormValue; currencies: string[] }) {
  const { locale, dict } = useI18n();
  const c = dict.admin.courses;
  const t = (l: string) => value.translations.find((x) => x.locale === l);
  const pick = (k: keyof Translation): L => Object.fromEntries(LOCALES.map((l) => [l, (() => { const v = t(l)?.[k]; return Array.isArray(v) ? v.join("\n") : (v ?? ""); })()]));
  return (
    <ActionForm action={saveCourse} className="space-y-8">
      <input type="hidden" name="locale" value={locale} />
      {value.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{c.translations}</h3>
        <BiField name="title" label={c.titleField} value={pick("title")} required maxLength={200} />
        <BiField name="subtitle" label={c.subtitle} value={pick("subtitle")} maxLength={300} />
        <BiField name="description" label={c.description} value={pick("description")} multiline rows={6} maxLength={10000} />
        <BiField name="objectives" label={c.objectives} value={pick("objectives")} multiline rows={5} />
        <BiField name="target_audience" label={c.audience} value={pick("target_audience")} multiline rows={2} />
        <BiField name="certificate_requirements" label={c.certificateRequirements} value={pick("certificate_requirements")} multiline rows={2} />
      </section>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{c.general}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={c.slug} htmlFor="slug" required><Input id="slug" name="slug" defaultValue={value.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} /></Field>
          <Field label={c.level} htmlFor="level">
            <Select id="level" name="level" defaultValue={value.level}>
              {(["beginner", "intermediate", "advanced"] as const).map((l) => <option key={l} value={l}>{dict.levels[l]}</option>)}
            </Select>
          </Field>
          <Field label={c.price} htmlFor="price" required><Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={value.price} required /></Field>
          <Field label={c.currency} htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={value.currency}>{currencies.map((cur) => <option key={cur}>{cur}</option>)}</Select>
          </Field>
          <Field label={c.accessDays} htmlFor="access_days" required><Input id="access_days" name="access_days" type="number" min={1} max={3650} defaultValue={value.access_days} required /></Field>
          <Field label={c.durationWeeks} htmlFor="duration_weeks"><Input id="duration_weeks" name="duration_weeks" type="number" min={1} defaultValue={value.duration_weeks ?? ""} /></Field>
          <Field label={c.estimatedHours} htmlFor="estimated_hours"><Input id="estimated_hours" name="estimated_hours" type="number" min={1} defaultValue={value.estimated_hours ?? ""} /></Field>
          <Field label={c.sortOrder} htmlFor="sort_order"><Input id="sort_order" name="sort_order" type="number" min={0} defaultValue={value.sort_order} /></Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span className="text-sm font-medium text-slate-700">{c.deliveryLocales}:</span>
          {LOCALES.map((l) => <Checkbox key={l} name={`deliver_${l}`} label={l === "nl" ? c.dutch : c.english} defaultChecked={value.delivery_locales.includes(l)} />)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox name="is_featured" label={c.featured} defaultChecked={value.is_featured} />
          <Checkbox name="enrollment_open" label={c.enrollmentOpen} defaultChecked={value.enrollment_open} />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{c.settings}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox name="certificate_enabled" label={c.certificateEnabled} defaultChecked={value.certificate_enabled} />
          <Checkbox name="require_all_mandatory_lessons" label={c.requireLessons} defaultChecked={value.require_all_mandatory_lessons} />
          <Checkbox name="require_assignments" label={c.requireAssignments} defaultChecked={value.require_assignments} />
          <Checkbox name="require_final_exam" label={c.requireExam} defaultChecked={value.require_final_exam} />
        </div>
      </section>
      <SubmitButton>{value.id ? dict.common.save : dict.common.create}</SubmitButton>
    </ActionForm>
  );
}

export function CourseStatusActions({ courseId, status }: { courseId: string; status: string }) {
  const { dict } = useI18n();
  const c = dict.admin.courses;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== "published" ? <ActionButton action={setCourseStatus} fields={{ course_id: courseId, status: "published" }} variant="primary">{c.publish}</ActionButton> : null}
      {status === "published" ? <ActionButton action={setCourseStatus} fields={{ course_id: courseId, status: "draft" }} confirm={`${c.unpublish}?`}>{c.unpublish}</ActionButton> : null}
      {status !== "archived" ? <ActionButton action={setCourseStatus} fields={{ course_id: courseId, status: "archived" }} confirm={`${c.archive}?`}>{c.archive}</ActionButton> : null}
      {status !== "published" ? <ActionButton action={deleteCourse} fields={{ course_id: courseId }} variant="danger" confirm={c.deleteConfirm}><Trash2 className="size-4" />{dict.common.delete}</ActionButton> : null}
    </div>
  );
}

export function CourseImageForm({ courseId, imageUrl }: { courseId: string; imageUrl: string | null }) {
  const { locale, dict } = useI18n();
  const c = dict.admin.courses;
  const [state, dispatch, pending] = useActionState(setCourseImage, null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const up = await uploadFile(file, "public-assets", locale, "course");
      const fd = new FormData();
      fd.set("locale", locale);
      fd.set("course_id", courseId);
      fd.set("storage_path", up.storage_path);
      startTransition(() => dispatch(fd));
    } catch (x) {
      setErr(x instanceof Error ? x.message : dict.errors.uploadFailed);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="space-y-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="aspect-video w-full rounded-xl object-cover ring-1 ring-slate-200" />
      ) : <div className="grid aspect-video place-items-center rounded-xl bg-slate-100 text-sm text-slate-400">—</div>}
      <label className={buttonClass("secondary", "sm", "w-full cursor-pointer")}>
        {busy || pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{c.image}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onChange} disabled={busy || pending} />
      </label>
      <p className="text-xs text-slate-500">{c.imageHint}</p>
      {imageUrl ? <ActionButton action={setCourseImage} fields={{ course_id: courseId, storage_path: "" }} variant="ghost">{c.removeImage}</ActionButton> : null}
      {err ? <Alert tone="error">{err}</Alert> : null}
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------
export function ModuleForm({ courseId, module }: { courseId: string; module?: { id: string; title: L; description: L } }) {
  const { locale, dict } = useI18n();
  const c = dict.admin.courses;
  return (
    <ActionForm action={saveModule} className="space-y-3" resetOnSuccess={!module}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="course_id" value={courseId} />
      {module ? <input type="hidden" name="id" value={module.id} /> : null}
      <BiField name="title" label={c.moduleTitle} value={module?.title} required maxLength={200} />
      <BiField name="description" label={c.moduleDescription} value={module?.description} maxLength={2000} />
      <SubmitButton size="sm">{module ? dict.common.save : c.addModule}</SubmitButton>
    </ActionForm>
  );
}

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  const { locale, dict } = useI18n();
  const c = dict.admin.courses;
  return (
    <ActionForm action={createLesson} className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="module_id" value={moduleId} />
      <Field label={`${dict.admin.lessons.title} · ${c.dutch}`} htmlFor={`t-nl-${moduleId}`}><Input id={`t-nl-${moduleId}`} name="title_nl" maxLength={200} required /></Field>
      <Field label={`${dict.admin.lessons.title} · ${c.english}`} htmlFor={`t-en-${moduleId}`}><Input id={`t-en-${moduleId}`} name="title_en" maxLength={200} /></Field>
      <Field label={c.lessonType} htmlFor={`type-${moduleId}`}>
        <Select id={`type-${moduleId}`} name="type" defaultValue="text">
          {(["text", "video", "pdf", "assignment", "quiz", "external"] as const).map((t) => <option key={t} value={t}>{dict.lessonTypes[t]}</option>)}
        </Select>
      </Field>
      <SubmitButton size="sm">{c.addLesson}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteModuleButton({ id }: { id: string }) {
  const { dict } = useI18n();
  return <ActionButton action={deleteModule} fields={{ id }} variant="ghost" confirm={`${dict.admin.courses.deleteModule}?`}><Trash2 className="size-4" /><span className="sr-only">{dict.admin.courses.deleteModule}</span></ActionButton>;
}

export function CreateExamButton({ courseId }: { courseId: string }) {
  const { dict } = useI18n();
  return <ActionButton action={createFinalExam} fields={{ course_id: courseId }} variant="primary">{dict.admin.courses.createExam}</ActionButton>;
}

// ---------------------------------------------------------------------------
// Lesson editor
// ---------------------------------------------------------------------------
export type LessonFormValue = {
  id: string; module_id: string; type: string; status: string; title: L; summary: L; estimated_minutes: number | null; is_mandatory: boolean; is_preview: boolean;
  body: L; video_provider: string | null; video_ref: L; external_url: string | null;
};

export function LessonForm({ value, modules }: { value: LessonFormValue; modules: { id: string; label: string }[] }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.lessons;
  const [type, setType] = useState(value.type);
  return (
    <ActionForm action={saveLesson} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={value.id} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={dict.admin.courses.lessonType} htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {(["text", "video", "pdf", "assignment", "quiz", "external"] as const).map((t) => <option key={t} value={t}>{dict.lessonTypes[t]}</option>)}
          </Select>
        </Field>
        <Field label={a.module} htmlFor="module_id">
          <Select id="module_id" name="module_id" defaultValue={value.module_id}>{modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
        </Field>
        <Field label={a.minutes} htmlFor="estimated_minutes"><Input id="estimated_minutes" name="estimated_minutes" type="number" min={1} max={1000} defaultValue={value.estimated_minutes ?? ""} /></Field>
        <Field label={a.status} htmlFor="status">
          <Select id="status" name="status" defaultValue={value.status}>
            <option value="draft">{dict.courseStatus.draft}</option>
            <option value="published">{dict.courseStatus.published}</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="is_mandatory" label={a.mandatory} defaultChecked={value.is_mandatory} />
        <Checkbox name="is_preview" label={a.preview} defaultChecked={value.is_preview} />
      </div>
      <BiField name="title" label={a.title} value={value.title} required maxLength={200} />
      <BiField name="summary" label={a.summary} value={value.summary} maxLength={1000} />
      {type === "video" ? (
        <div className="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <Field label={a.videoProvider} htmlFor="video_provider" className="max-w-xs">
            <Select id="video_provider" name="video_provider" defaultValue={value.video_provider ?? "youtube"}>
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="bunny">Bunny Stream</option>
              <option value="url">MP4 URL</option>
            </Select>
          </Field>
          <BiField name="video" label={a.videoRef} value={value.video_ref} maxLength={500} hint={a.videoHint} />
        </div>
      ) : (
        <>
          <input type="hidden" name="video_provider" value={value.video_provider ?? ""} />
          {LOCALES.map((l) => <input key={l} type="hidden" name={`video_${l}`} value={value.video_ref?.[l] ?? ""} />)}
        </>
      )}
      {type === "external" ? (
        <Field label={a.externalUrl} htmlFor="external_url"><Input id="external_url" name="external_url" type="url" placeholder="https://" defaultValue={value.external_url ?? ""} maxLength={1000} /></Field>
      ) : <input type="hidden" name="external_url" value={value.external_url ?? ""} />}
      <BiField name="body" label={a.body} value={value.body} multiline rows={14} hint={a.bodyHint} />
      <SubmitButton>{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteLessonButton({ id }: { id: string }) {
  const { dict } = useI18n();
  return <ActionButton action={deleteLesson} fields={{ id }} variant="danger" confirm={dict.admin.lessons.deleteConfirm}><Trash2 className="size-4" />{dict.admin.lessons.deleteLesson}</ActionButton>;
}

export function ResourceUpload({ lessonId }: { lessonId: string }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.lessons;
  const [kind, setKind] = useState<"file" | "link">("file");
  const [state, dispatch, pending] = useActionState(addResource, null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (kind === "file") {
      const file = fd.get("file");
      fd.delete("file");
      if (!(file instanceof File) || file.size === 0) { setErr(dict.errors.validation); return; }
      setBusy(true);
      try {
        const up = await uploadFile(file, "course-resources", locale, "course");
        fd.set("storage_path", up.storage_path);
      } catch (x) {
        setErr(x instanceof Error ? x.message : dict.errors.uploadFailed);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    startTransition(() => dispatch(fd));
    form.reset();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        {(["file", "link"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", kind === k ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200")}>
            {k === "file" ? a.addFile : a.addLink}
          </button>
        ))}
      </div>
      <BiField name="title" label={a.resourceTitle} maxLength={200} required />
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        {kind === "file" ? (
          <Field label={a.addFile} htmlFor="res-file"><Input id="res-file" name="file" type="file" required /></Field>
        ) : (
          <Field label={a.url} htmlFor="res-url"><Input id="res-url" name="url" type="url" placeholder="https://" required /></Field>
        )}
        <Field label={a.resourceLocale} htmlFor="resource_locale">
          <Select id="resource_locale" name="resource_locale" defaultValue="">
            <option value="">{a.allLanguages}</option>
            <option value="nl">{dict.admin.courses.dutch}</option>
            <option value="en">{dict.admin.courses.english}</option>
          </Select>
        </Field>
      </div>
      {err ? <Alert tone="error">{err}</Alert> : null}
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <button type="submit" disabled={busy || pending} className={buttonClass("primary", "sm")}>
        {busy || pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? a.uploading : dict.common.add}
      </button>
    </form>
  );
}

export function DeleteResourceButton({ id }: { id: string }) {
  const { dict } = useI18n();
  return <ActionButton action={deleteResource} fields={{ id }} variant="ghost" confirm={`${dict.common.delete}?`}><Trash2 className="size-4" /><span className="sr-only">{dict.common.delete}</span></ActionButton>;
}

export function AssignmentSettingsForm({ lessonId, value }: { lessonId: string; value: { instructions: L; submission_type: string; is_required: boolean; requires_review: boolean; max_score: number } | null }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.lessons;
  return (
    <ActionForm action={saveAssignmentSettings} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <BiField name="instructions" label={a.instructions} value={value?.instructions} multiline rows={6} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={a.submissionType} htmlFor="submission_type">
          <Select id="submission_type" name="submission_type" defaultValue={value?.submission_type ?? "any"}>
            {(["any", "text", "file", "link"] as const).map((k) => <option key={k} value={k}>{a.submissionTypes[k]}</option>)}
          </Select>
        </Field>
        <Field label={a.maxScore} htmlFor="max_score"><Input id="max_score" name="max_score" type="number" min={1} max={1000} defaultValue={value?.max_score ?? 100} /></Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="requires_review" label={a.requiresReview} defaultChecked={value?.requires_review ?? true} />
        <Checkbox name="is_required" label={a.required} defaultChecked={value?.is_required ?? true} />
      </div>
      <SubmitButton size="sm">{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}
