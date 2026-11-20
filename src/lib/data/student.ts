import "server-only";
import { createClient } from "@/lib/supabase/server";
import { COURSE_SELECT } from "@/lib/data/catalog";
import type { Course, Enrollment, PaymentStatus } from "@/lib/types";

export type Progress = { total_lessons: number; completed_lessons: number; mandatory_total: number; mandatory_completed: number; percentage: number };
export type Completion = {
  lessons_total: number; lessons_done: number; lessons_ok: boolean;
  assignments_total: number; assignments_done: number; assignments_ok: boolean;
  exam_required: boolean; exam_available: boolean; exam_passed: boolean; exam_best: number | null; exam_ok: boolean;
  certificate_enabled: boolean; eligible: boolean;
};

export type LatestPayment = { id: string; status: PaymentStatus; rejection_reason: string | null; submitted_at: string };
export type StudentEnrollment = Enrollment & { course: Course; latestPayment: LatestPayment | null; progress: Progress | null; isLive: boolean };

/** All enrollments of the signed-in student with course info, latest payment and progress. */
export async function getMyEnrollments(userId: string): Promise<StudentEnrollment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(`*, course:courses(${COURSE_SELECT}), payments(id, status, rejection_reason, submitted_at)`)
    .eq("student_id", userId)
    .order("requested_at", { ascending: false });
  const rows = (data ?? []) as (Enrollment & { course: Course; payments: LatestPayment[] })[];
  const now = Date.now();
  return Promise.all(
    rows.map(async (r) => {
      const latestPayment = [...(r.payments ?? [])].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null;
      const isLive = r.status === "active" && !!r.expires_at && new Date(r.expires_at).getTime() > now;
      let progress: Progress | null = null;
      if (r.status === "active" || r.status === "expired") {
        const { data: p } = await supabase.rpc("course_progress", { p_student: userId, p_course: r.course_id });
        progress = (p as Progress[] | null)?.[0] ?? null;
      }
      const { payments: _ignored, ...rest } = r;
      void _ignored;
      return { ...rest, latestPayment, progress, isLive };
    }),
  );
}

export async function getCompletion(userId: string, courseId: string): Promise<Completion | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("completion_status", { p_student: userId, p_course: courseId });
  return (data as Completion | null) ?? null;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

export type LessonState = { accessed: boolean; resourceAccessed: boolean; completed: boolean };

/**
 * Course outline plus the signed-in student's enrollment, access state and per-lesson progress.
 * Returns null when the course is not visible to the student at all.
 */
export async function getStudentCourse(slug: string, userId: string) {
  const { getCourseOutline } = await import("@/lib/data/catalog");
  const outline = await getCourseOutline(slug);
  if (!outline) return null;
  const supabase = await createClient();
  const [{ data: enrollment }, { data: access }, { data: progressRows }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", userId)
      .eq("course_id", outline.id)
      .in("status", ["active", "expired", "revoked"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle<Enrollment>(),
    supabase.rpc("has_course_access", { p_course_id: outline.id }),
    supabase.from("lesson_progress").select("lesson_id, resource_accessed_at, completed_at").eq("student_id", userId).eq("course_id", outline.id),
  ]);
  const progress = new Map<string, LessonState>(
    (progressRows ?? []).map((r) => [r.lesson_id as string, { accessed: true, resourceAccessed: Boolean(r.resource_accessed_at), completed: Boolean(r.completed_at) }]),
  );
  const lessons = outline.modules.flatMap((m) => m.lessons);
  return { outline, enrollment: enrollment ?? null, hasAccess: access === true, progress, lessons };
}
