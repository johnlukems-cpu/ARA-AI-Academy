import type { Localized } from "@/lib/localize";

export type UserRole = "student" | "admin";
export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  country: string;
  preferred_locale: string;
  avatar_url: string | null;
  role: UserRole;
  status: "active" | "suspended";
  created_at: string;
};

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published" | "archived";
export type LessonType = "video" | "text" | "pdf" | "assignment" | "quiz" | "external";

export type CourseTranslation = {
  locale: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  objectives: string[];
  target_audience: string | null;
  certificate_requirements: string | null;
};

export type Course = {
  id: string;
  slug: string;
  status: CourseStatus;
  level: CourseLevel;
  price: number;
  currency: string;
  access_days: number;
  duration_weeks: number | null;
  estimated_hours: number | null;
  image_url: string | null;
  is_featured: boolean;
  enrollment_open: boolean;
  sort_order: number;
  require_all_mandatory_lessons: boolean;
  require_assignments: boolean;
  require_final_exam: boolean;
  certificate_enabled: boolean;
  delivery_locales: string[];
  course_translations?: CourseTranslation[];
};

export type Module = { id: string; course_id: string; position: number; title: Localized; description: Localized };
export type Lesson = {
  id: string;
  module_id: string;
  course_id: string;
  position: number;
  type: LessonType;
  title: Localized;
  summary: Localized;
  estimated_minutes: number | null;
  is_mandatory: boolean;
  is_preview: boolean;
  status: "draft" | "published";
};

export type EnrollmentStatus = "pending" | "active" | "expired" | "revoked" | "cancelled";
export type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  source: "self" | "admin" | "gateway";
  access_days: number;
  extended_days: number;
  requested_at: string;
  activated_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  last_lesson_id: string | null;
};

export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded";
export type PaymentMethod = {
  id: string;
  code: string;
  kind: string;
  provider: string;
  name: Localized;
  instructions: Localized;
  requires_proof: boolean;
  requires_reference: boolean;
  is_active: boolean;
  sort_order: number;
};

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export type AcademySettings = {
  academy_name: string;
  company_name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  address: string | null;
  currency: string;
  supported_currencies: string[];
  default_access_days: number;
  default_passing_score: number;
  enrollment_open: boolean;
  reminder_days: number[];
  certificate_signatory_name: string | null;
  certificate_signatory_title: Localized;
  certificate_signature_url: string | null;
  certificate_accent_color: string;
};
