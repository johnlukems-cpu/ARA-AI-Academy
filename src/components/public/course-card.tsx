import Link from "next/link";
import { Clock, CalendarDays, ArrowRight, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import type { Course } from "@/lib/types";
import { courseText } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const covers = [
  "from-brand-700 via-brand-500 to-accent-500",
  "from-ink-3 via-brand-700 to-brand-400",
  "from-accent-600 via-brand-600 to-brand-800",
  "from-brand-900 via-brand-600 to-accent-400",
];

export function CourseCover({ course, className = "" }: { course: Course; className?: string }) {
  if (course.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={course.image_url} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  const cover = covers[(course.sort_order ?? 0) % covers.length];
  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${cover} ${className}`} aria-hidden>
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="absolute -right-8 -top-8 size-40 rounded-full bg-white/10 blur-2xl" />
      <Sparkles className="absolute bottom-4 right-4 size-10 text-white/30" />
    </div>
  );
}

export function CourseCard({ course, locale }: { course: Course; locale: Locale }) {
  const dict = getDictionary(locale);
  const t = courseText(course, locale);
  return (
    <Link
      href={`/${locale}/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="relative aspect-[16/9]">
        <CourseCover course={course} />
        <Badge tone="neutral" className="absolute left-3 top-3 bg-white/90 ring-white/60 backdrop-blur">{dict.levels[course.level]}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-700">{t.title}</h3>
        {t.subtitle ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.subtitle}</p> : null}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {course.duration_weeks ? (
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{course.duration_weeks} {dict.common.weeks}</span>
          ) : null}
          {course.estimated_hours ? (
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{course.estimated_hours} {dict.common.hours}</span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="font-display text-lg font-bold text-slate-900">
            {Number(course.price) > 0 ? formatMoney(course.price, course.currency, locale) : dict.common.priceOnRequest}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
            {dict.common.viewCourse}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
