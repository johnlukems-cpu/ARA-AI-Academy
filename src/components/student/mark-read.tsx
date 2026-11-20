"use client";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { markAllNotificationsRead } from "@/app/actions/student";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const { dict } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(() => markAllNotificationsRead())}>
      {dict.notifications.markAllRead}
    </Button>
  );
}
