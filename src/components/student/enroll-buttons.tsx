"use client";
import { useI18n } from "@/i18n/client";
import { requestEnrollment, cancelEnrollment } from "@/app/actions/enrollment";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function RequestEnrollmentButton({ courseId }: { courseId: string }) {
  const { locale, dict } = useI18n();
  return (
    <ActionForm action={requestEnrollment}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="course_id" value={courseId} />
      <SubmitButton size="lg" pendingLabel={dict.common.submitting}>{dict.enroll.submitRequest}</SubmitButton>
    </ActionForm>
  );
}

export function CancelEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const { locale, dict } = useI18n();
  return (
    <ActionForm action={cancelEnrollment}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <SubmitButton variant="ghost" size="sm" confirm={dict.enroll.cancel + "?"}>{dict.enroll.cancel}</SubmitButton>
    </ActionForm>
  );
}
