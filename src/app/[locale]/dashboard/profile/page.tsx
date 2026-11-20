import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProfileForm, PasswordForm, AvatarUpload } from "@/components/student/profile-forms";

export default async function ProfilePage({ params }: PageProps<"/[locale]/dashboard/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { profile } = await requireUser(locale);
  return (
    <>
      <PageHeader title={dict.profile.title} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={dict.profile.personal} />
            <CardBody><ProfileForm profile={profile} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={dict.profile.password} />
            <CardBody><PasswordForm /></CardBody>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title={dict.profile.avatar} />
          <CardBody><AvatarUpload current={profile.avatar_url} name={profile.first_name || profile.email} /></CardBody>
        </Card>
      </div>
    </>
  );
}
