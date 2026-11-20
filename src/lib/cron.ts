import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailStudent } from "@/lib/notify";

const DAY = 86_400_000;

/** Which reminder (days before expiry) is due now, or null. Pure; unit tested. */
export function dueReminder(expiresAt: Date, now: Date, reminderDays: number[]): number | null {
  const left = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY);
  if (left <= 0) return null;
  const candidates = reminderDays.filter((d) => left <= d).sort((a, b) => a - b);
  return candidates[0] ?? null;
}

export type DailyResult = { expired: number; reminders: number; errors: string[] };

/** Daily maintenance: expire lapsed enrollments, send expiry reminders, prune rate limits. */
export async function runDailyJobs(now = new Date()): Promise<DailyResult> {
  const db = createAdminClient();
  const result: DailyResult = { expired: 0, reminders: 0, errors: [] };

  const { data: expired, error: expErr } = await db.rpc("expire_enrollments");
  if (expErr) result.errors.push(`expire: ${expErr.message}`);
  for (const e of (expired ?? []) as { student_id: string; course_id: string }[]) {
    await emailStudent(e.student_id, "access_expired", { courseId: e.course_id });
    result.expired++;
  }

  const { data: settings } = await db.from("academy_settings").select("reminder_days").eq("id", 1).maybeSingle();
  const days = ((settings?.reminder_days as number[] | undefined) ?? [30, 14, 7, 1]).filter((d) => d > 0);
  if (days.length) {
    const horizon = new Date(now.getTime() + (Math.max(...days) + 1) * DAY).toISOString();
    const { data: active } = await db
      .from("enrollments")
      .select("id, student_id, course_id, expires_at")
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", horizon);
    for (const e of (active ?? []) as { id: string; student_id: string; course_id: string; expires_at: string }[]) {
      const d = dueReminder(new Date(e.expires_at), now, days);
      if (d === null) continue;
      // The primary key makes this idempotent: only the first run inserts and emails.
      const { data: inserted, error } = await db
        .from("enrollment_reminders")
        .upsert({ enrollment_id: e.id, kind: `days_${d}` }, { onConflict: "enrollment_id,kind", ignoreDuplicates: true })
        .select("enrollment_id");
      if (error) {
        result.errors.push(`reminder ${e.id}: ${error.message}`);
        continue;
      }
      if (!inserted?.length) continue;
      const left = Math.ceil((new Date(e.expires_at).getTime() - now.getTime()) / DAY);
      await db.from("notifications").insert({ user_id: e.student_id, type: "access_reminder", payload: { course_id: e.course_id, days: left } });
      await emailStudent(e.student_id, "access_reminder", { courseId: e.course_id, expiresAt: e.expires_at, vars: { days: left } });
      result.reminders++;
    }
  }

  await db.from("rate_limits").delete().lt("window_start", new Date(now.getTime() - DAY).toISOString());
  return result;
}
