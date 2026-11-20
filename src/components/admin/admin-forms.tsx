"use client";
import { useI18n } from "@/i18n/client";
import {
  manualEnroll, extendEnrollment, revokeEnrollment, setUserStatus, setUserRole, resetProgress, sendPasswordReset,
  reviewSubmission, revokeCertificate, reissueCertificate, issueCertificate, markMessageHandled,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ActionButton } from "./builder";

const Hidden = ({ fields }: { fields: Record<string, string> }) => {
  const { locale } = useI18n();
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
};

export function ManualEnrollForm({ studentId, courses, methods, defaultDays }: {
  studentId: string; courses: { id: string; title: string }[]; methods: { id: string; name: string }[]; defaultDays: number;
}) {
  const { dict } = useI18n();
  const s = dict.admin.students;
  return (
    <ActionForm action={manualEnroll} className="space-y-3" resetOnSuccess>
      <Hidden fields={{ student_id: studentId }} />
      <p className="text-sm text-slate-600">{s.manualEnrollText}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={dict.admin.payments.course} htmlFor="me-course" required>
          <Select id="me-course" name="course_id" required>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        </Field>
        <Field label={s.days} htmlFor="me-days"><Input id="me-days" name="days" type="number" min={1} max={3650} defaultValue={defaultDays} /></Field>
        <Field label={s.amountOptional} htmlFor="me-amount"><Input id="me-amount" name="amount" type="number" min={0} step="0.01" /></Field>
        <Field label={dict.admin.payments.method} htmlFor="me-method">
          <Select id="me-method" name="payment_method_id" defaultValue=""><option value="">—</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        </Field>
        <Field label={s.referenceOptional} htmlFor="me-ref"><Input id="me-ref" name="reference" maxLength={120} /></Field>
        <Field label={s.noteOptional} htmlFor="me-note"><Input id="me-note" name="note" maxLength={1000} /></Field>
      </div>
      <SubmitButton size="sm" confirm={`${s.manualEnroll}?`}>{s.manualEnroll}</SubmitButton>
    </ActionForm>
  );
}

export function EnrollmentActions({ enrollmentId, status, userId, courseId }: { enrollmentId: string; status: string; userId: string; courseId: string }) {
  const { dict } = useI18n();
  const s = dict.admin.students;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {status === "active" || status === "expired" ? (
        <ActionForm action={extendEnrollment} className="flex flex-wrap items-end gap-2">
          <Hidden fields={{ enrollment_id: enrollmentId }} />
          <Field label={s.extendDays} htmlFor={`ext-${enrollmentId}`} className="w-28"><Input id={`ext-${enrollmentId}`} name="days" type="number" min={1} max={3650} defaultValue={30} required /></Field>
          <Field label={s.noteOptional} htmlFor={`extr-${enrollmentId}`} className="min-w-40 flex-1"><Input id={`extr-${enrollmentId}`} name="reason" maxLength={500} /></Field>
          <SubmitButton size="sm" variant="secondary">{s.extend}</SubmitButton>
        </ActionForm>
      ) : null}
      {status === "active" ? (
        <ActionForm action={revokeEnrollment} className="flex flex-wrap items-end gap-2">
          <Hidden fields={{ enrollment_id: enrollmentId }} />
          <Field label={s.revokeReason} htmlFor={`rev-${enrollmentId}`} className="min-w-40 flex-1"><Input id={`rev-${enrollmentId}`} name="reason" maxLength={500} required /></Field>
          <SubmitButton size="sm" variant="danger" confirm={`${s.revoke}?`}>{s.revoke}</SubmitButton>
        </ActionForm>
      ) : null}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <ActionButton action={resetProgress} fields={{ user_id: userId, course_id: courseId }} confirm={s.resetProgressConfirm}>{s.resetProgress}</ActionButton>
        <ActionButton action={issueCertificate} fields={{ user_id: userId, course_id: courseId }}>{dict.admin.certificates.issueManually}</ActionButton>
      </div>
    </div>
  );
}

export function AccountActions({ userId, email, status, role, isSelf }: { userId: string; email: string; status: string; role: string; isSelf: boolean }) {
  const { dict } = useI18n();
  const s = dict.admin.students;
  return (
    <div className="space-y-4">
      <ActionButton action={sendPasswordReset} fields={{ user_id: userId, email }}>{s.sendReset}</ActionButton>
      {isSelf ? null : (
        <>
          {status === "active" ? (
            <ActionForm action={setUserStatus} className="space-y-2">
              <Hidden fields={{ user_id: userId, status: "suspended" }} />
              <Field label={s.suspendReason} htmlFor="susp-reason"><Textarea id="susp-reason" name="reason" rows={2} maxLength={500} /></Field>
              <SubmitButton size="sm" variant="danger" confirm={`${s.suspend}?`}>{s.suspend}</SubmitButton>
            </ActionForm>
          ) : (
            <ActionButton action={setUserStatus} fields={{ user_id: userId, status: "active" }} variant="primary">{s.activate}</ActionButton>
          )}
          <div>
            {role === "student" ? (
              <ActionButton action={setUserRole} fields={{ user_id: userId, role: "admin" }} confirm={`${s.makeAdmin}?`}>{s.makeAdmin}</ActionButton>
            ) : (
              <ActionButton action={setUserRole} fields={{ user_id: userId, role: "student" }} confirm={`${s.makeStudent}?`}>{s.makeStudent}</ActionButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function SubmissionReviewForm({ submissionId, maxScore, score, feedback }: { submissionId: string; maxScore: number; score: number | null; feedback: string | null }) {
  const { dict } = useI18n();
  const a = dict.admin.submissions;
  return (
    <ActionForm action={reviewSubmission} className="space-y-3">
      <Hidden fields={{ submission_id: submissionId }} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <Field label={`${a.score} (max ${maxScore})`} htmlFor={`sc-${submissionId}`}><Input id={`sc-${submissionId}`} name="score" type="number" min={0} max={maxScore} defaultValue={score ?? ""} /></Field>
        <Field label={a.feedback} htmlFor={`fb-${submissionId}`}><Textarea id={`fb-${submissionId}`} name="feedback" rows={3} maxLength={5000} defaultValue={feedback ?? ""} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" name="status" value="approved">{a.approve}</SubmitButton>
        <SubmitButton size="sm" variant="secondary" name="status" value="needs_revision">{a.needsRevision}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CertificateActions({ certificateId, status }: { certificateId: string; status: string }) {
  const { dict } = useI18n();
  const c = dict.admin.certificates;
  return (
    <div className="space-y-3">
      {status === "valid" ? (
        <ActionForm action={revokeCertificate} className="flex flex-wrap items-end gap-2">
          <Hidden fields={{ certificate_id: certificateId }} />
          <Field label={c.revokeReason} htmlFor={`cr-${certificateId}`} className="min-w-48 flex-1"><Input id={`cr-${certificateId}`} name="reason" maxLength={500} required /></Field>
          <SubmitButton size="sm" variant="danger" confirm={`${c.revoke}?`}>{c.revoke}</SubmitButton>
        </ActionForm>
      ) : null}
      <div>
        <ActionButton action={reissueCertificate} fields={{ certificate_id: certificateId }} confirm={c.reissueHint}>{c.reissue}</ActionButton>
        <p className="mt-1 text-xs text-slate-500">{c.reissueHint}</p>
      </div>
    </div>
  );
}

export function MessageHandledButton({ id }: { id: string }) {
  const { dict } = useI18n();
  return <ActionButton action={markMessageHandled} fields={{ message_id: id }}>{dict.admin.messages.markHandled}</ActionButton>;
}
