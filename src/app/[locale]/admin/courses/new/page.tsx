import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { CourseForm } from "@/components/admin/builder";

export default async function NewCourse({ params }: PageProps<"/[locale]/admin/courses/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = getDictionary(locale);
  const settings = await getSettings();
  return (
    <>
      <Link href={`/${locale}/admin/courses`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />{dict.admin.courses.title}</Link>
      <PageHeader title={dict.admin.courses.new} />
      <Card>
        <CardBody>
          <CourseForm
            currencies={settings.supported_currencies}
            value={{
              slug: "", level: "beginner", price: 0, currency: settings.currency, access_days: settings.default_access_days, duration_weeks: null, estimated_hours: null,
              sort_order: 100, is_featured: false, enrollment_open: true, require_all_mandatory_lessons: true, require_assignments: true, require_final_exam: true,
              certificate_enabled: true, delivery_locales: ["nl", "en"], translations: [],
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
