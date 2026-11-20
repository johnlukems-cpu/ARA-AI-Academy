"use client";
import { startTransition, useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { submitAssignment } from "@/app/actions/learning";
import { uploadFile } from "@/components/forms/upload";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

type Previous = { text_answer: string | null; link_url: string | null; file_name: string | null; storage_path: string | null } | null;

export function AssignmentForm({ assignmentId, submissionType, previous, resubmit }: {
  assignmentId: string;
  submissionType: "text" | "file" | "link" | "any";
  previous: Previous;
  resubmit: boolean;
}) {
  const { locale, dict } = useI18n();
  const l = dict.learn;
  const [state, dispatch, pending] = useActionState(submitAssignment, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const showText = submissionType === "text" || submissionType === "any";
  const showLink = submissionType === "link" || submissionType === "any";
  const showFile = submissionType === "file" || submissionType === "any";

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setUploadError(null);
    const fd = new FormData(ev.currentTarget);
    const file = fd.get("file");
    fd.delete("file");
    if (file instanceof File && file.size > 0) {
      setUploading(true);
      try {
        const up = await uploadFile(file, "assignment-files", locale);
        fd.set("storage_path", up.storage_path);
        fd.set("file_name", up.file_name);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : dict.errors.uploadFailed);
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (previous?.storage_path) {
      fd.set("storage_path", previous.storage_path);
      fd.set("file_name", previous.file_name ?? "");
    }
    startTransition(() => dispatch(fd));
  }

  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  const busy = uploading || pending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="assignment_id" value={assignmentId} />
      {showText ? (
        <Field label={l.submissionText} htmlFor="text_answer">
          <Textarea id="text_answer" name="text_answer" rows={8} maxLength={20000} defaultValue={previous?.text_answer ?? ""} />
        </Field>
      ) : null}
      {showLink ? (
        <Field label={l.submissionLink} htmlFor="link_url">
          <Input id="link_url" name="link_url" type="url" maxLength={1000} placeholder="https://" defaultValue={previous?.link_url ?? ""} />
        </Field>
      ) : null}
      {showFile ? (
        <Field label={l.submissionFile} htmlFor="file" hint={previous?.file_name ? `${l.uploadedFile}: ${previous.file_name}` : undefined}>
          <Input id="file" name="file" type="file" className="file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700" />
        </Field>
      ) : null}
      {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {uploading ? l.uploading : resubmit ? l.resubmitAssignment : l.submitAssignment}
      </button>
    </form>
  );
}
