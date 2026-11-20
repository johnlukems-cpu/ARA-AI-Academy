import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/i18n/config";
import type { AcademySettings, Course, CourseTranslation, Lesson, Module, PaymentMethod } from "@/lib/types";

export const COURSE_SELECT =
  "id, slug, status, level, price, currency, access_days, duration_weeks, estimated_hours, image_url, is_featured, enrollment_open, sort_order, require_all_mandatory_lessons, require_assignments, require_final_exam, certificate_enabled, delivery_locales, course_translations(locale, title, subtitle, description, objectives, target_audience, certificate_requirements)";

export function courseText(course: Pick<Course, "course_translations">, locale: Locale): CourseTranslation {
  const list = course.course_translations ?? [];
  return (
    list.find((t) => t.locale === locale) ??
    list[0] ?? { locale, title: "", subtitle: null, description: null, objectives: [], target_audience: null, certificate_requirements: null }
  );
}

const DEFAULT_SETTINGS: AcademySettings = {
  academy_name: "ARA AI Academy",
  company_name: "ARA AI Solutions",
  logo_url: null,
  contact_email: null,
  contact_phone: null,
  contact_whatsapp: null,
  address: null,
  currency: "SRD",
  supported_currencies: ["SRD", "USD", "EUR"],
  default_access_days: 90,
  default_passing_score: 70,
  enrollment_open: true,
  reminder_days: [30, 14, 7, 1],
  certificate_signatory_name: null,
  certificate_signatory_title: { nl: "Directeur", en: "Director" },
  certificate_signature_url: null,
  certificate_accent_color: "#4F46E5",
};

export const getSettings = cache(async (): Promise<AcademySettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_settings")
    .select(
      "academy_name, company_name, logo_url, contact_email, contact_phone, contact_whatsapp, address, currency, supported_currencies, default_access_days, default_passing_score, enrollment_open, reminder_days, certificate_signatory_name, certificate_signatory_title, certificate_signature_url, certificate_accent_color",
    )
    .eq("id", 1)
    .maybeSingle<AcademySettings>();
  return data ?? DEFAULT_SETTINGS;
});

export const getPublishedCourses = cache(async (): Promise<Course[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("status", "published")
    .order("sort_order")
    .returns<Course[]>();
  return data ?? [];
});

export type CourseOutline = Course & {
  modules: (Module & { lessons: Lesson[] })[];
  hasFinalExam: boolean;
};

export const getCourseOutline = cache(async (slug: string): Promise<CourseOutline | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select(COURSE_SELECT).eq("slug", slug).maybeSingle<Course>();
  if (!course) return null;
  const [{ data: modules }, { data: lessons }, { data: exam }] = await Promise.all([
    supabase.from("course_modules").select("*").eq("course_id", course.id).order("position").returns<Module[]>(),
    supabase.from("lessons").select("*").eq("course_id", course.id).eq("status", "published").order("position").returns<Lesson[]>(),
    supabase.from("quizzes").select("id").eq("course_id", course.id).eq("kind", "final_exam").eq("status", "published").maybeSingle(),
  ]);
  const byModule = new Map<string, Lesson[]>();
  for (const l of lessons ?? []) byModule.set(l.module_id, [...(byModule.get(l.module_id) ?? []), l]);
  return {
    ...course,
    modules: (modules ?? []).map((m) => ({ ...m, lessons: byModule.get(m.id) ?? [] })).filter((m) => m.lessons.length > 0),
    hasFinalExam: Boolean(exam),
  };
});

export const getActivePaymentMethods = cache(async (): Promise<PaymentMethod[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("*").eq("is_active", true).order("sort_order").returns<PaymentMethod[]>();
  return data ?? [];
});
