import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getPublishedCourses } from "@/lib/data/catalog";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { CourseCard } from "@/components/public/course-card";

export default async function BrowsePage({ params }: PageProps<"/[locale]/dashboard/browse">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const courses = await getPublishedCourses();
  return (
    <>
      <PageHeader title={dict.portal.browse} description={dict.catalog.intro} />
      {courses.length ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => <CourseCard key={c.id} course={c} locale={locale} />)}
        </div>
      ) : (
        <EmptyState title={dict.catalog.empty} />
      )}
    </>
  );
}
