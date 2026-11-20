import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GraduationCap, Pencil } from "lucide-react";
import { z } from "zod";
import { getDictionary, fmt } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/catalog";
import { tr, type Localized } from "@/lib/localize";
import { lessonIcons } from "@/components/ui/lesson-icons";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  CourseForm, CourseStatusActions, CourseImageForm, ModuleForm, AddLessonForm, DeleteModuleButton, MoveButtons, CreateExamButton,
  type CourseFormValue,
} from "@/components/admin/builder";

type ModuleRow = { id: string; position: number; title: Localized; description: Localized };
type LessonRow = { id: string; module_id: string; position: number; type: "text"; title: Localized; status: "draft" | "published"; is_mandatory: boolean; is_preview: boolean };

export default async function AdminCourseEdit({ params }: PageProps<"/[locale]/admin/courses/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const c = dict.admin.courses;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*, course_translations(*)").eq("id", id).maybeSingle();
  if (!course) notFound();
  const [{ data: modules }, { data: lessons }, { data: exam }, settings] = await Promise.all([
    supabase.from("course_modules").select("id, position, title, description").eq("course_id", id).order("position").returns<ModuleRow[]>(),
    supabase.from("lessons").select("id, module_id, position, type, title, status, is_mandatory, is_preview").eq("course_id", id).order("position").returns<LessonRow[]>(),
    supabase.from("quizzes").select("id, status, title, quiz_questions(count)").eq("course_id", id).eq("kind", "final_exam").maybeSingle(),
    getSettings(),
  ]);
  const byModule = new Map<string, LessonRow[]>();
  for (const l of lessons ?? []) byModule.set(l.module_id, [...(byModule.get(l.module_id) ?? []), l]);
  const t = (course.course_translations as { locale: string; title: string }[]) ?? [];
  const title = t.find((x) => x.locale === locale)?.title ?? t[0]?.title ?? course.slug;
  const examCount = (exam?.quiz_questions as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
  const published = (lessons ?? []).filter((l) => l.status === "published").length;
  const mods = modules ?? [];

  return (
    <>
      <Link href={`/${locale}/admin/courses`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{c.title}</Link>
      <PageHeader
        title={title}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={statusTone[course.status]}>{dict.courseStatus[course.status as "draft"]}</Badge>{fmt(c.publishedLessons, { published, total: (lessons ?? []).length })}</span>}
        actions={course.status === "published" ? <ButtonLink href={`/${locale}/courses/${course.slug}`} variant="secondary" size="sm"><ExternalLink className="size-4" />{c.preview}</ButtonLink> : null}
      />

      <Card className="mb-6">
        <CardBody className="space-y-3">
          <CourseStatusActions courseId={id} status={course.status} />
          <p className="text-xs text-slate-500">{c.publishHint}</p>
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={c.curriculum} />
            <CardBody className="space-y-6">
              {mods.length === 0 ? <Alert tone="info">{c.noModules}</Alert> : null}
              {mods.map((m, mi) => {
                const list = byModule.get(m.id) ?? [];
                return (
                  <div key={m.id} className="rounded-2xl ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="font-semibold text-slate-900"><span className="mr-2 text-xs uppercase text-brand-600">{fmt(dict.learn.module, { n: mi + 1 })}</span>{tr(m.title, locale)}</p>
                      <span className="flex items-center gap-1">
                        <MoveButtons kind="module" id={m.id} first={mi === 0} last={mi === mods.length - 1} />
                        {list.length === 0 ? <DeleteModuleButton id={m.id} /> : null}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {list.map((l, li) => {
                        const Icon = lessonIcons[l.type];
                        return (
                          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Icon className="size-4 shrink-0 text-slate-400" />
                            <Link href={`/${locale}/admin/courses/${id}/lessons/${l.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700">{tr(l.title, locale)}</Link>
                            {l.is_preview ? <Badge tone="info">{dict.admin.lessons.preview}</Badge> : null}
                            <Badge tone={statusTone[l.status]}>{dict.courseStatus[l.status]}</Badge>
                            <MoveButtons kind="lesson" id={l.id} first={li === 0} last={li === list.length - 1} />
                            <Link href={`/${locale}/admin/courses/${id}/lessons/${l.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" aria-label={dict.common.edit}><Pencil className="size-4" /></Link>
                          </li>
                        );
                      })}
                    </ul>
                    <details className="group border-t border-slate-100">
                      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50">+ {c.addLesson}</summary>
                      <div className="px-4 pb-4"><AddLessonForm moduleId={m.id} /></div>
                    </details>
                    <details className="border-t border-slate-100">
                      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">{c.editModule}</summary>
                      <div className="px-4 pb-4"><ModuleForm courseId={id} module={m} /></div>
                    </details>
                  </div>
                );
              })}
              <details className="rounded-2xl border border-dashed border-slate-300">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700">+ {c.addModule}</summary>
                <div className="px-4 pb-4"><ModuleForm courseId={id} /></div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={c.edit} />
            <CardBody>
              <CourseForm
                currencies={settings.supported_currencies}
                value={{ ...(course as unknown as CourseFormValue), translations: course.course_translations as CourseFormValue["translations"] }}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={c.finalExam} />
            <CardBody className="space-y-3">
              {exam ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><GraduationCap className="size-4 text-brand-600" />{tr(exam.title, locale)}</p>
                  <div className="flex gap-2"><Badge tone={statusTone[exam.status]}>{dict.courseStatus[exam.status as "draft"]}</Badge><Badge>{fmt(c.examQuestions, { n: examCount })}</Badge></div>
                  <ButtonLink href={`/${locale}/admin/quizzes/${exam.id}`} size="sm" variant="secondary">{c.editExam}</ButtonLink>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{c.noExam}</p>
                  <CreateExamButton courseId={id} />
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={c.image} />
            <CardBody><CourseImageForm courseId={id} imageUrl={course.image_url} /></CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
