"use client";
import { Play } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { beginQuiz } from "@/app/actions/learning";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function BeginQuizButton({ quizId, label }: { quizId: string; label: string }) {
  const { locale } = useI18n();
  return (
    <ActionForm action={beginQuiz}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="quiz_id" value={quizId} />
      <SubmitButton><Play className="size-4" />{label}</SubmitButton>
    </ActionForm>
  );
}
