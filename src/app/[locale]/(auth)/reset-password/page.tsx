import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { ResetForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";

export default async function ResetPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const current = await getCurrentUser();
  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">{dict.auth.resetTitle}</h1>
      <div className="mt-8">
        {current ? <ResetForm /> : (
          <div className="space-y-4">
            <Alert tone="error">{dict.auth.linkInvalid}</Alert>
            <ButtonLink href={`/${locale}/forgot-password`} variant="secondary">{dict.auth.forgotButton}</ButtonLink>
          </div>
        )}
      </div>
    </>
  );
}
