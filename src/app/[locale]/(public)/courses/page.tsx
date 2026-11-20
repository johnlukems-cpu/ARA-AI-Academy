import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getPublishedCourses } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { Container, PageHero } from "@/components/public/section";
import { CourseCard } from "@/components/public/course-card";
import { cn } from "@/components/ui/cn";

export async function generateMetadata({ params }: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).catalog.title } : {};
}

const levels = ["beginner", "intermediate", "advanced"] as const;

export default async function CoursesPage({ params, searchParams }: PageProps<"/[locale]/courses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { level } = await searchParams;
  const dict = getDictionary(locale);
  const all = await getPublishedCourses();
  const courses = typeof level === "string" && (levels as readonly string[]).includes(level) ? all.filter((c) => c.level === level) : all;
  const chip = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={cn("rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition-colors", active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>
      {label}
    </Link>
  );
  return (
    <>
      <PageHero title={dict.catalog.title} text={dict.catalog.intro} />
      <Container className="py-12">
        <div className="flex flex-wrap gap-2" role="navigation" aria-label={dict.catalog.filterLevel}>
          {chip(`/${locale}/courses`, dict.catalog.allLevels, !level)}
          {levels.map((l) => chip(`/${locale}/courses?level=${l}`, dict.levels[l], level === l))}
        </div>
        {courses.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} locale={locale} />)}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
            {isSupabaseConfigured() ? dict.catalog.empty : dict.common.notConfigured}
          </p>
        )}
      </Container>
    </>
  );
}
