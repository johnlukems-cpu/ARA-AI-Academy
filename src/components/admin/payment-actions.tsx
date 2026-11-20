"use client";
import { useI18n } from "@/i18n/client";
import { approvePayment, rejectPayment, refundPayment, savePaymentNotes } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea, Checkbox } from "@/components/ui/form";

export function PaymentReviewPanel({ paymentId, status }: { paymentId: string; status: string }) {
  const { locale, dict } = useI18n();
  const a = dict.admin.payments;
  if (status === "pending") {
    return (
      <Card>
        <CardHeader title={dict.common.actions} />
        <CardBody className="space-y-6">
          <ActionForm action={approvePayment}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="payment_id" value={paymentId} />
            <SubmitButton className="w-full" confirm={`${a.approve}?`}>{a.approve}</SubmitButton>
          </ActionForm>
          <div className="border-t border-slate-100 pt-5">
            <ActionForm action={rejectPayment} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="payment_id" value={paymentId} />
              <Field label={a.rejectReason} htmlFor="reason" required>
                <Textarea id="reason" name="reason" required rows={3} maxLength={1000} />
              </Field>
              <SubmitButton variant="danger" className="w-full">{a.reject}</SubmitButton>
            </ActionForm>
          </div>
        </CardBody>
      </Card>
    );
  }
  if (status === "approved") {
    return (
      <Card>
        <CardHeader title={dict.common.actions} />
        <CardBody>
          <ActionForm action={refundPayment} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="payment_id" value={paymentId} />
            <Checkbox name="revoke" label={a.refundRevoke} defaultChecked />
            <SubmitButton variant="secondary" className="w-full" confirm={`${a.refund}?`}>{a.refund}</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    );
  }
  return null;
}

export function PaymentNotesForm({ paymentId, notes }: { paymentId: string; notes: string }) {
  const { locale, dict } = useI18n();
  return (
    <ActionForm action={savePaymentNotes} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="payment_id" value={paymentId} />
      <Textarea name="notes" defaultValue={notes} rows={4} maxLength={5000} aria-label={dict.admin.payments.adminNotes} />
      <SubmitButton variant="secondary" size="sm">{dict.common.save}</SubmitButton>
    </ActionForm>
  );
}
