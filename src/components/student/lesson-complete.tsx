"use client";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { completeLesson } from "@/app/actions/learning";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function LessonCompleteButton({ lessonId, hint }: { lessonId: string; hint?: string }) {
  const { locale, dict } = useI18n();
  return (
    <ActionForm action={completeLesson}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      {hint ? <p className="mb-3 text-sm text-slate-600">{hint}</p> : null}
      <SubmitButton><CheckCircle2 className="size-4" />{dict.learn.markComplete}</SubmitButton>
    </ActionForm>
  );
}
