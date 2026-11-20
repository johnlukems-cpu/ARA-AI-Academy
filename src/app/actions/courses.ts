"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActionAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getObjectInfo, publicUrl } from "@/lib/storage";
import { videoEmbed } from "@/lib/video";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { getDictionary } from "@/i18n";
import { isLocale, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";

const loc = (v: unknown): Locale => (isLocale(v) ? v : "nl");
const str = (fd: FormData, k: string, max = 20000) => String(fd.get(k) ?? "").trim().slice(0, max);
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const optInt = (fd: FormData, k: string): number | null => {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
/** Read `${key}_nl` / `${key}_en` into a locale-keyed object, dropping empty values. */
const localized = (fd: FormData, key: string, max = 20000) => {
  const out: Record<string, string> = {};
  for (const l of locales) {
    const v = str(fd, `${key}_${l}`, max);
    if (v) out[l] = v;
  }
  return out;
};
const both = (v: Record<string, unknown> | null | undefined) => locales.every((l) => typeof v?.[l] === "string" && (v[l] as string).trim() !== "");

type Ctx = { locale: Locale; dict: Dictionary; adminId: string };

async function guard(fd: FormData): Promise<Ctx | ActionResult> {
  const locale = loc(fd.get("locale"));
  const dict = getDictionary(locale);
  const admin = await getActionAdmin();
  if (!admin) return { ok: false, error: dict.errors.notAuthorized };
  return { locale, dict, adminId: admin.user.id };
}
const isCtx = (v: Ctx | ActionResult): v is Ctx => "adminId" in v;

function refresh(locale: Locale, courseId?: string) {
  revalidatePath(`/${locale}/admin/courses`, "layout");
  if (courseId) revalidatePath(`/${locale}`, "layout");
}

const uuid = (v: unknown) => z.uuid().safeParse(v);

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
const courseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  price: z.coerce.number().min(0).max(10_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  access_days: z.coerce.number().int().min(1).max(3650),
  duration_weeks: z.number().int().min(1).max(520).nullable(),
  estimated_hours: z.number().int().min(1).max(10000).nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000),
});

export async function saveCourse(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = str(fd, "id");
  const parsed = courseSchema.safeParse({
    slug: str(fd, "slug").toLowerCase(),
    level: str(fd, "level"),
    price: str(fd, "price") || "0",
    currency: str(fd, "currency").toUpperCase() || "SRD",
    access_days: str(fd, "access_days") || "90",
    duration_weeks: optInt(fd, "duration_weeks"),
    estimated_hours: optInt(fd, "estimated_hours"),
    sort_order: str(fd, "sort_order") || "0",
  });
  if (!parsed.success) return { ok: false, error: dict.errors.validation, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), dict.errors.validation])) };
  const delivery = locales.filter((l) => bool(fd, `deliver_${l}`));
  const row = {
    ...parsed.data,
    delivery_locales: delivery.length ? delivery : [...locales],
    is_featured: bool(fd, "is_featured"),
    enrollment_open: bool(fd, "enrollment_open"),
    require_all_mandatory_lessons: bool(fd, "require_all_mandatory_lessons"),
    require_assignments: bool(fd, "require_assignments"),
    require_final_exam: bool(fd, "require_final_exam"),
    certificate_enabled: bool(fd, "certificate_enabled"),
  };
  const translations = locales.map((l) => ({
    locale: l,
    title: str(fd, `title_${l}`, 200),
    subtitle: str(fd, `subtitle_${l}`, 300) || null,
    description: str(fd, `description_${l}`, 10000) || null,
    objectives: str(fd, `objectives_${l}`, 5000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
    target_audience: str(fd, `target_audience_${l}`, 2000) || null,
    certificate_requirements: str(fd, `certificate_requirements_${l}`, 2000) || null,
  }));
  if (!translations.some((t) => t.title)) return { ok: false, error: dict.errors.validation, fieldErrors: { title_nl: dict.errors.validation } };

  const supabase = await createClient();
  let courseId = id;
  if (id) {
    if (!uuid(id).success) return { ok: false, error: dict.errors.validation };
    const { data: current } = await supabase.from("courses").select("status").eq("id", id).maybeSingle();
    if (!current) return { ok: false, error: dict.errors.notFound };
    const { error } = await supabase.from("courses").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? dict.errors.slug_taken : errorMessage(dict, error) };
  } else {
    const { data, error } = await supabase.from("courses").insert({ ...row, status: "draft", created_by: adminId }).select("id").single();
    if (error || !data) return { ok: false, error: error?.code === "23505" ? dict.errors.slug_taken : errorMessage(dict, error) };
    courseId = data.id;
  }
  // Translations: keep a row per language that has a title (title is NOT NULL).
  const rows = translations.filter((t) => t.title).map((t) => ({ ...t, course_id: courseId }));
  const { error: tErr } = await supabase.from("course_translations").upsert(rows, { onConflict: "course_id,locale" });
  if (tErr) return { ok: false, error: errorMessage(dict, tErr) };
  const missing = translations.filter((t) => !t.title).map((t) => t.locale);
  if (missing.length) await supabase.from("course_translations").delete().eq("course_id", courseId).in("locale", missing);

  await audit(adminId, id ? "course.update" : "course.create", "course", courseId, { slug: row.slug });
  refresh(locale, courseId);
  if (!id) redirect(`/${locale}/admin/courses/${courseId}`);
  return { ok: true, message: dict.common.saved };
}

export async function setCourseImage(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("course_id"));
  const path = str(fd, "storage_path", 300);
  if (!id.success) return { ok: false, error: dict.errors.validation };
  let url: string | null = null;
  if (path) {
    if (!/^courses\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path) || !(await getObjectInfo("public-assets", path))) return { ok: false, error: dict.errors.uploadFailed };
    url = publicUrl(path);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ image_url: url }).eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "course.image", "course", id.data, {});
  refresh(locale, id.data);
  return { ok: true, message: dict.common.saved };
}

/** Collect reasons a course cannot be published yet. */
async function publishProblems(courseId: string, dict: Dictionary): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: course }, { data: tr }, { data: lessons }, { data: exam }] = await Promise.all([
    supabase.from("courses").select("price, require_final_exam").eq("id", courseId).maybeSingle(),
    supabase.from("course_translations").select("locale, title, description").eq("course_id", courseId),
    supabase.from("lessons").select("id, title, status").eq("course_id", courseId),
    supabase.from("quizzes").select("id, status").eq("course_id", courseId).eq("kind", "final_exam").maybeSingle(),
  ]);
  const problems: string[] = [];
  if (!course) return [dict.errors.notFound];
  const okText = locales.every((l) => tr?.some((t) => t.locale === l && t.title?.trim() && t.description?.trim()));
  if (!okText || !(Number(course.price) > 0)) problems.push(dict.errors.publish_incomplete);
  const published = (lessons ?? []).filter((l) => l.status === "published");
  if (published.length === 0) problems.push(dict.errors.publish_no_lessons);
  if (course.require_final_exam) {
    let examOk = exam?.status === "published";
    if (examOk && exam) {
      const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", exam.id);
      examOk = (count ?? 0) > 0;
    }
    if (!examOk) problems.push(dict.errors.publish_exam_missing);
  }
  return problems;
}

export async function setCourseStatus(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("course_id"));
  const status = z.enum(["draft", "published", "archived"]).safeParse(fd.get("status"));
  if (!id.success || !status.success) return { ok: false, error: dict.errors.validation };
  if (status.data === "published") {
    const problems = await publishProblems(id.data, dict);
    if (problems.length) return { ok: false, error: problems.join(" ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ status: status.data, ...(status.data === "published" ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, `course.${status.data}`, "course", id.data, {});
  refresh(locale, id.data);
  return { ok: true, message: dict.common.saved };
}

export async function deleteCourse(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("course_id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const [{ count: enr }, { count: pay }] = await Promise.all([
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id.data),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("course_id", id.data),
  ]);
  if ((enr ?? 0) > 0 || (pay ?? 0) > 0) return { ok: false, error: dict.admin.courses.deleteBlocked };
  const { data: course } = await supabase.from("courses").select("slug, status").eq("id", id.data).maybeSingle();
  if (!course) return { ok: false, error: dict.errors.notFound };
  if (course.status === "published") return { ok: false, error: dict.admin.courses.deleteBlocked };
  const { error } = await supabase.from("courses").delete().eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "course.delete", "course", id.data, { slug: course.slug });
  refresh(locale);
  redirect(`/${locale}/admin/courses`);
}

// ---------------------------------------------------------------------------
// Ordering (modules, lessons, questions, resources)
// ---------------------------------------------------------------------------
const orderable = {
  module: { table: "course_modules", parent: "course_id" },
  lesson: { table: "lessons", parent: "module_id" },
  question: { table: "quiz_questions", parent: "quiz_id" },
  resource: { table: "lesson_resources", parent: "lesson_id" },
} as const;

export async function moveItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const kind = z.enum(["module", "lesson", "question", "resource"]).safeParse(fd.get("kind"));
  const id = uuid(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!kind.success || !id.success) return { ok: false, error: dict.errors.validation };
  const { table, parent } = orderable[kind.data];
  const supabase = await createClient();
  const { data: item } = await supabase.from(table).select(`id, ${parent}`).eq("id", id.data).maybeSingle();
  if (!item) return { ok: false, error: dict.errors.notFound };
  const parentId = (item as unknown as Record<string, string>)[parent];
  const { data: siblings } = await supabase.from(table).select("id, position").eq(parent, parentId).order("position").order("id");
  const list = (siblings ?? []) as { id: string; position: number }[];
  const idx = list.findIndex((s) => s.id === id.data);
  const swap = idx + dir;
  if (idx === -1 || swap < 0 || swap >= list.length) return { ok: true };
  [list[idx], list[swap]] = [list[swap], list[idx]];
  // Renumber the whole sibling list so positions stay dense and unique.
  for (let i = 0; i < list.length; i++) {
    if (list[i].position !== i + 1) await supabase.from(table).update({ position: i + 1 }).eq("id", list[i].id);
  }
  await audit(adminId, `${kind.data}.move`, kind.data, id.data, { dir });
  refresh(locale);
  return { ok: true };
}

async function nextPosition(table: string, parent: string, parentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("position").eq(parent, parentId).order("position", { ascending: false }).limit(1).maybeSingle();
  return ((data as { position: number } | null)?.position ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
export async function saveModule(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const title = localized(fd, "title", 200);
  const description = localized(fd, "description", 2000);
  if (!Object.keys(title).length) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const id = str(fd, "id");
  if (id) {
    if (!uuid(id).success) return { ok: false, error: dict.errors.validation };
    const { error } = await supabase.from("course_modules").update({ title, description }).eq("id", id);
    if (error) return { ok: false, error: errorMessage(dict, error) };
    await audit(adminId, "module.update", "module", id, {});
  } else {
    const courseId = uuid(fd.get("course_id"));
    if (!courseId.success) return { ok: false, error: dict.errors.validation };
    const position = await nextPosition("course_modules", "course_id", courseId.data);
    const { data, error } = await supabase.from("course_modules").insert({ course_id: courseId.data, title, description, position }).select("id").single();
    if (error || !data) return { ok: false, error: errorMessage(dict, error) };
    await audit(adminId, "module.create", "module", data.id, { course_id: courseId.data });
  }
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

export async function deleteModule(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("module_id", id.data);
  if ((count ?? 0) > 0) return { ok: false, error: dict.errors.module_not_empty };
  const { error } = await supabase.from("course_modules").delete().eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "module.delete", "module", id.data, {});
  refresh(locale);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
const lessonType = z.enum(["video", "text", "pdf", "assignment", "quiz", "external"]);

async function ensureTypeRows(lessonId: string, courseId: string, type: string, title: Record<string, string>) {
  const supabase = await createClient();
  if (type === "assignment") {
    await supabase.from("assignments").upsert({ lesson_id: lessonId, course_id: courseId }, { onConflict: "lesson_id", ignoreDuplicates: true });
  }
  if (type === "quiz") {
    const { data } = await supabase.from("quizzes").select("id").eq("lesson_id", lessonId).maybeSingle();
    if (!data) await supabase.from("quizzes").insert({ course_id: courseId, lesson_id: lessonId, kind: "quiz", title, status: "draft" });
  }
}

export async function createLesson(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const moduleId = uuid(fd.get("module_id"));
  const type = lessonType.safeParse(fd.get("type"));
  const title = localized(fd, "title", 200);
  if (!moduleId.success || !type.success || !Object.keys(title).length) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data: mod } = await supabase.from("course_modules").select("course_id").eq("id", moduleId.data).maybeSingle();
  if (!mod) return { ok: false, error: dict.errors.notFound };
  const position = await nextPosition("lessons", "module_id", moduleId.data);
  const { data, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId.data, course_id: mod.course_id, type: type.data, title, position, status: "draft" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: errorMessage(dict, error) };
  await supabase.from("lesson_contents").insert({ lesson_id: data.id, course_id: mod.course_id });
  await ensureTypeRows(data.id, mod.course_id, type.data, title);
  await audit(adminId, "lesson.create", "lesson", data.id, { course_id: mod.course_id, type: type.data });
  refresh(locale);
  redirect(`/${locale}/admin/courses/${mod.course_id}/lessons/${data.id}`);
}

/** Reasons a lesson cannot be published. */
async function lessonProblems(lessonId: string, dict: Dictionary): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: lesson }, { data: content }, { count: resources }, { data: quiz }] = await Promise.all([
    supabase.from("lessons").select("type, title").eq("id", lessonId).maybeSingle(),
    supabase.from("lesson_contents").select("body, video_provider, video_ref, external_url").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lesson_resources").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId),
    supabase.from("quizzes").select("id, status").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  if (!lesson) return [dict.errors.notFound];
  const p: string[] = [];
  if (!both(lesson.title)) p.push(dict.errors.lesson_title_missing);
  const body = content?.body as Record<string, string> | null;
  switch (lesson.type) {
    case "text":
      if (!both(body)) p.push(dict.errors.lesson_content_missing);
      break;
    case "video": {
      const ref = (content?.video_ref ?? {}) as Record<string, string>;
      const ok = locales.some((l) => videoEmbed(content?.video_provider, ref[l]));
      if (!ok) p.push(dict.errors.lesson_video_missing);
      break;
    }
    case "pdf":
      if (!resources) p.push(dict.errors.lesson_resource_missing);
      break;
    case "external":
      if (!content?.external_url) p.push(dict.errors.lesson_content_missing);
      break;
    case "quiz": {
      let ok = quiz?.status === "published";
      if (ok && quiz) {
        const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quiz.id);
        ok = (count ?? 0) > 0;
      }
      if (!ok) p.push(dict.errors.lesson_quiz_missing);
      break;
    }
  }
  return p;
}

export async function saveLesson(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  const type = lessonType.safeParse(fd.get("type"));
  const status = z.enum(["draft", "published"]).safeParse(fd.get("status"));
  const moduleId = uuid(fd.get("module_id"));
  const minutes = optInt(fd, "estimated_minutes");
  if (!id.success || !type.success || !status.success || !moduleId.success || Number.isNaN(minutes) || (minutes !== null && (minutes < 1 || minutes > 1000))) {
    return { ok: false, error: dict.errors.validation };
  }
  const title = localized(fd, "title", 200);
  if (!Object.keys(title).length) return { ok: false, error: dict.errors.validation };
  const provider = str(fd, "video_provider");
  const videoProvider = z.enum(["youtube", "vimeo", "bunny", "url"]).safeParse(provider);
  const externalUrl = str(fd, "external_url", 1000);
  if (externalUrl && !/^https:\/\//.test(externalUrl)) return { ok: false, error: dict.errors.validation, fieldErrors: { external_url: dict.errors.validation } };

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id, module_id").eq("id", id.data).maybeSingle();
  if (!lesson) return { ok: false, error: dict.errors.notFound };
  const { data: mod } = await supabase.from("course_modules").select("course_id").eq("id", moduleId.data).maybeSingle();
  if (!mod || mod.course_id !== lesson.course_id) return { ok: false, error: dict.errors.validation };

  const update: Record<string, unknown> = {
    type: type.data,
    title,
    summary: localized(fd, "summary", 1000),
    estimated_minutes: minutes,
    is_mandatory: bool(fd, "is_mandatory"),
    is_preview: bool(fd, "is_preview"),
    status: "draft",
  };
  if (moduleId.data !== lesson.module_id) {
    update.module_id = moduleId.data;
    update.position = await nextPosition("lessons", "module_id", moduleId.data);
  }
  const { error } = await supabase.from("lessons").update(update).eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const { error: cErr } = await supabase.from("lesson_contents").upsert({
    lesson_id: id.data,
    course_id: lesson.course_id,
    body: localized(fd, "body", 100000),
    video_provider: videoProvider.success ? videoProvider.data : null,
    video_ref: localized(fd, "video", 500),
    external_url: externalUrl || null,
  });
  if (cErr) return { ok: false, error: errorMessage(dict, cErr) };
  await ensureTypeRows(id.data, lesson.course_id, type.data, title);

  // Publish only after content was saved and validated.
  let message = dict.common.saved;
  if (status.data === "published") {
    const problems = await lessonProblems(id.data, dict);
    if (problems.length) {
      refresh(locale);
      return { ok: false, error: `${dict.admin.lessons.savedAsDraft} ${problems.join(" ")}` };
    }
    await supabase.from("lessons").update({ status: "published" }).eq("id", id.data);
    message = dict.admin.lessons.published;
  }
  await audit(adminId, "lesson.update", "lesson", id.data, { status: status.data });
  refresh(locale, lesson.course_id);
  return { ok: true, message };
}

export async function deleteLesson(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", id.data).maybeSingle();
  if (!lesson) return { ok: false, error: dict.errors.notFound };
  // Lesson quizzes are detached by FK (on delete set null); remove them explicitly.
  await supabase.from("quizzes").delete().eq("lesson_id", id.data);
  const { data: files } = await supabase.from("lesson_resources").select("storage_path").eq("lesson_id", id.data).not("storage_path", "is", null);
  const { error } = await supabase.from("lessons").delete().eq("id", id.data);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  const paths = (files ?? []).map((f) => f.storage_path as string);
  if (paths.length) await createAdminClient().storage.from("course-resources").remove(paths);
  await audit(adminId, "lesson.delete", "lesson", id.data, {});
  refresh(locale, lesson.course_id);
  redirect(`/${locale}/admin/courses/${lesson.course_id}`);
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
export async function addResource(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const lessonId = uuid(fd.get("lesson_id"));
  const kind = z.enum(["file", "link"]).safeParse(fd.get("kind"));
  const title = localized(fd, "title", 200);
  const resLocale = str(fd, "resource_locale");
  if (!lessonId.success || !kind.success || !Object.keys(title).length) return { ok: false, error: dict.errors.validation };
  if (resLocale && !isLocale(resLocale)) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", lessonId.data).maybeSingle();
  if (!lesson) return { ok: false, error: dict.errors.notFound };
  const row: Record<string, unknown> = {
    lesson_id: lessonId.data,
    course_id: lesson.course_id,
    kind: kind.data,
    title,
    locale: resLocale || null,
    position: await nextPosition("lesson_resources", "lesson_id", lessonId.data),
  };
  if (kind.data === "link") {
    const url = str(fd, "url", 1000);
    if (!/^https:\/\/\S+$/.test(url)) return { ok: false, error: dict.errors.validation, fieldErrors: { url: dict.errors.validation } };
    row.url = url;
  } else {
    const path = str(fd, "storage_path", 300);
    if (!/^resources\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(path)) return { ok: false, error: dict.errors.uploadFailed };
    const info = await getObjectInfo("course-resources", path);
    if (!info) return { ok: false, error: dict.errors.uploadFailed };
    row.storage_path = path;
    row.mime_type = info.mimetype || null;
    row.file_size = info.size || null;
  }
  const { error } = await supabase.from("lesson_resources").insert(row);
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "resource.create", "lesson", lessonId.data, { kind: kind.data });
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

export async function deleteResource(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_resources").delete().eq("id", id.data).select("storage_path, lesson_id").maybeSingle();
  if (data?.storage_path) await createAdminClient().storage.from("course-resources").remove([data.storage_path]);
  await audit(adminId, "resource.delete", "lesson", data?.lesson_id ?? null, { resource: id.data });
  refresh(locale);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export async function saveAssignmentSettings(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const lessonId = uuid(fd.get("lesson_id"));
  const type = z.enum(["text", "file", "link", "any"]).safeParse(fd.get("submission_type"));
  const maxScore = z.coerce.number().int().min(1).max(1000).safeParse(str(fd, "max_score") || "100");
  if (!lessonId.success || !type.success || !maxScore.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", lessonId.data).maybeSingle();
  if (!lesson) return { ok: false, error: dict.errors.notFound };
  const { error } = await supabase.from("assignments").upsert(
    {
      lesson_id: lessonId.data,
      course_id: lesson.course_id,
      instructions: localized(fd, "instructions", 20000),
      submission_type: type.data,
      is_required: bool(fd, "is_required"),
      requires_review: bool(fd, "requires_review"),
      max_score: maxScore.data,
    },
    { onConflict: "lesson_id" },
  );
  if (error) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "assignment.update", "lesson", lessonId.data, {});
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

// ---------------------------------------------------------------------------
// Quizzes & exams
// ---------------------------------------------------------------------------
export async function createFinalExam(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const courseId = uuid(fd.get("course_id"));
  if (!courseId.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("quizzes").select("id").eq("course_id", courseId.data).eq("kind", "final_exam").maybeSingle();
  let quizId = existing?.id as string | undefined;
  if (!quizId) {
    const { data: settings } = await supabase.from("academy_settings").select("default_passing_score").eq("id", 1).maybeSingle();
    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        course_id: courseId.data,
        kind: "final_exam",
        title: { nl: "Eindexamen", en: "Final exam" },
        passing_score: settings?.default_passing_score ?? 70,
        time_limit_minutes: 30,
        max_attempts: 3,
        retake_wait_hours: 24,
        show_correct_answers: false,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: errorMessage(dict, error) };
    quizId = data.id;
    await audit(adminId, "exam.create", "quiz", data.id, { course_id: courseId.data });
  }
  refresh(locale);
  redirect(`/${locale}/admin/quizzes/${quizId}`);
}

export async function saveQuiz(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  const status = z.enum(["draft", "published"]).safeParse(fd.get("status"));
  const schema = z.object({
    passing_score: z.number().int().min(1).max(100),
    time_limit_minutes: z.number().int().min(1).max(600).nullable(),
    max_attempts: z.number().int().min(1).max(100).nullable(),
    question_count: z.number().int().min(1).max(500).nullable(),
    retake_wait_hours: z.number().int().min(0).max(8760),
  });
  const parsed = schema.safeParse({
    passing_score: optInt(fd, "passing_score") ?? 70,
    time_limit_minutes: optInt(fd, "time_limit_minutes"),
    max_attempts: optInt(fd, "max_attempts"),
    question_count: optInt(fd, "question_count"),
    retake_wait_hours: optInt(fd, "retake_wait_hours") ?? 0,
  });
  const title = localized(fd, "title", 200);
  if (!id.success || !status.success || !parsed.success || !Object.keys(title).length) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  if (status.data === "published") {
    const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", id.data);
    if (!count) return { ok: false, error: dict.errors.quiz_no_questions };
    if (!both(title)) return { ok: false, error: dict.errors.lesson_title_missing };
  }
  const { data, error } = await supabase
    .from("quizzes")
    .update({
      ...parsed.data,
      title,
      instructions: localized(fd, "instructions", 5000),
      shuffle_questions: bool(fd, "shuffle_questions"),
      show_correct_answers: bool(fd, "show_correct_answers"),
      status: status.data,
    })
    .eq("id", id.data)
    .select("course_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: errorMessage(dict, error) };
  await audit(adminId, "quiz.update", "quiz", id.data, { status: status.data });
  refresh(locale, data.course_id);
  return { ok: true, message: dict.common.saved };
}

type OptionInput = { id?: string; label: Record<string, string>; is_correct: boolean };

export async function saveQuestion(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const quizId = uuid(fd.get("quiz_id"));
  const qid = str(fd, "id");
  const type = z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]).safeParse(fd.get("type"));
  const points = z.coerce.number().min(0.5).max(100).safeParse(str(fd, "points") || "1");
  const prompt = localized(fd, "prompt", 2000);
  if (!quizId.success || !type.success || !points.success || !Object.keys(prompt).length || (qid && !uuid(qid).success)) {
    return { ok: false, error: dict.errors.validation };
  }
  let options: OptionInput[] = [];
  const accepted: Record<string, string[]> = {};
  if (type.data === "short_answer") {
    for (const l of locales) {
      const lines = str(fd, `accepted_${l}`, 3000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
      if (lines.length) accepted[l] = lines;
    }
    if (!Object.keys(accepted).length) return { ok: false, error: dict.errors.question_invalid };
  } else {
    try {
      const raw = JSON.parse(String(fd.get("options") ?? "[]")) as unknown[];
      options = z
        .array(z.object({ id: z.uuid().optional(), label: z.record(z.string(), z.string().max(500)), is_correct: z.boolean() }))
        .max(10)
        .parse(raw)
        .map((o) => ({ ...o, label: Object.fromEntries(Object.entries(o.label).filter(([k, v]) => isLocale(k) && v.trim())) }))
        .filter((o) => Object.keys(o.label).length);
    } catch {
      return { ok: false, error: dict.errors.question_invalid };
    }
    const correct = options.filter((o) => o.is_correct).length;
    const single = type.data !== "multiple_choice";
    if (options.length < 2 || correct < 1 || (single && correct !== 1)) return { ok: false, error: dict.errors.question_invalid };
  }

  const supabase = await createClient();
  const row = { quiz_id: quizId.data, type: type.data, prompt, explanation: localized(fd, "explanation", 2000), accepted_answers: accepted, points: points.data };
  let questionId = qid;
  if (qid) {
    const { error } = await supabase.from("quiz_questions").update(row).eq("id", qid).eq("quiz_id", quizId.data);
    if (error) return { ok: false, error: errorMessage(dict, error) };
  } else {
    const position = await nextPosition("quiz_questions", "quiz_id", quizId.data);
    const { data, error } = await supabase.from("quiz_questions").insert({ ...row, position }).select("id").single();
    if (error || !data) return { ok: false, error: errorMessage(dict, error) };
    questionId = data.id;
  }
  // Sync options, keeping existing ids so earlier attempts can still be reviewed.
  const { data: existing } = await supabase.from("quiz_options").select("id").eq("question_id", questionId);
  const keep = new Set(options.filter((o) => o.id).map((o) => o.id));
  const remove = (existing ?? []).map((o) => o.id as string).filter((id) => !keep.has(id));
  if (remove.length) await supabase.from("quiz_options").delete().in("id", remove);
  for (const [i, o] of options.entries()) {
    const data = { question_id: questionId, label: o.label, is_correct: o.is_correct, position: i + 1 };
    const { error } = o.id && (existing ?? []).some((e) => e.id === o.id)
      ? await supabase.from("quiz_options").update(data).eq("id", o.id)
      : await supabase.from("quiz_options").insert(data);
    if (error) return { ok: false, error: errorMessage(dict, error) };
  }
  await audit(adminId, qid ? "question.update" : "question.create", "quiz", quizId.data, { question: questionId });
  refresh(locale);
  return { ok: true, message: dict.common.saved };
}

export async function deleteQuestion(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await guard(fd);
  if (!isCtx(ctx)) return ctx;
  const { locale, dict, adminId } = ctx;
  const id = uuid(fd.get("id"));
  if (!id.success) return { ok: false, error: dict.errors.validation };
  const supabase = await createClient();
  const { data } = await supabase.from("quiz_questions").delete().eq("id", id.data).select("quiz_id").maybeSingle();
  await audit(adminId, "question.delete", "quiz", data?.quiz_id ?? null, { question: id.data });
  refresh(locale);
  return { ok: true };
}

