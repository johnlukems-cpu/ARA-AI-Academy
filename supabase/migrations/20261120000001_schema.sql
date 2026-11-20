-- ARA AI Academy – core schema
-- All user-facing translatable content uses either a translation table (courses)
-- or a jsonb object keyed by locale, e.g. {"nl": "...", "en": "..."}.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
create type public.lesson_type as enum ('video', 'text', 'pdf', 'assignment', 'quiz', 'external');
create type public.content_status as enum ('draft', 'published');
create type public.enrollment_status as enum ('pending', 'active', 'expired', 'revoked', 'cancelled');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'refunded');
create type public.submission_status as enum ('submitted', 'approved', 'needs_revision');
create type public.quiz_kind as enum ('quiz', 'final_exam');
create type public.question_type as enum ('single_choice', 'multiple_choice', 'true_false', 'short_answer');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');
create type public.certificate_status as enum ('valid', 'revoked');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  country text not null default 'SR',
  preferred_locale text not null default 'nl' check (preferred_locale ~ '^[a-z]{2}$'),
  avatar_url text,
  role public.user_role not null default 'student',
  status public.account_status not null default 'active',
  terms_accepted_at timestamptz,
  suspended_reason text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Academy settings (singleton row)
-- ---------------------------------------------------------------------------
create table public.academy_settings (
  id smallint primary key default 1 check (id = 1),
  academy_name text not null default 'ARA AI Academy',
  company_name text not null default 'ARA AI Solutions',
  logo_url text,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  address text,
  currency text not null default 'SRD',
  supported_currencies text[] not null default array['SRD', 'USD', 'EUR'],
  default_access_days int not null default 90 check (default_access_days between 1 and 3650),
  default_passing_score int not null default 70 check (default_passing_score between 1 and 100),
  enabled_locales text[] not null default array['nl', 'en'],
  default_locale text not null default 'nl',
  enrollment_open boolean not null default true,
  reminder_days int[] not null default array[30, 14, 7, 1],
  admin_notification_email text,
  certificate_signatory_name text,
  certificate_signatory_title jsonb not null default '{"nl": "Directeur", "en": "Director"}',
  certificate_signature_url text,
  certificate_accent_color text not null default '#4F46E5',
  certificate_footer jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create trigger academy_settings_updated_at before update on public.academy_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment methods (manual now, gateway-ready via provider column)
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]+$'),
  kind text not null default 'bank_transfer'
    check (kind in ('bank_transfer', 'mobile_money', 'cash', 'card', 'online_gateway', 'other')),
  provider text not null default 'manual',
  name jsonb not null,
  instructions jsonb not null default '{}'::jsonb,
  requires_proof boolean not null default true,
  requires_reference boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  config jsonb not null default '{}'::jsonb, -- non-secret provider settings only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payment_methods_updated_at before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.course_status not null default 'draft',
  level public.course_level not null default 'beginner',
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'SRD',
  access_days int not null default 90 check (access_days between 1 and 3650),
  duration_weeks int check (duration_weeks > 0),
  estimated_hours int check (estimated_hours > 0),
  image_url text,
  delivery_locales text[] not null default array['nl', 'en'],
  is_featured boolean not null default false,
  enrollment_open boolean not null default true,
  sort_order int not null default 0,
  -- completion requirements (separate from access duration)
  require_all_mandatory_lessons boolean not null default true,
  require_assignments boolean not null default true,
  require_final_exam boolean not null default true,
  certificate_enabled boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_status_idx on public.courses (status, sort_order);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_translations (
  course_id uuid not null references public.courses (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}$'),
  title text not null,
  subtitle text,
  description text,
  objectives text[] not null default '{}',
  target_audience text,
  requirements text,
  certificate_requirements text,
  updated_at timestamptz not null default now(),
  primary key (course_id, locale)
);
create trigger course_translations_updated_at before update on public.course_translations
  for each row execute function public.set_updated_at();

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null default 0,
  title jsonb not null,
  description jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_modules_course_idx on public.course_modules (course_id, position);
create trigger course_modules_updated_at before update on public.course_modules
  for each row execute function public.set_updated_at();

-- Lesson outline (visible for published courses)
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null default 0,
  type public.lesson_type not null default 'text',
  title jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  estimated_minutes int check (estimated_minutes > 0),
  is_mandatory boolean not null default true,
  is_preview boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- Protected lesson content (only with active access or preview)
create table public.lesson_contents (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body jsonb not null default '{}'::jsonb,          -- markdown per locale
  video_provider text check (video_provider in ('youtube', 'vimeo', 'bunny', 'url')),
  video_ref jsonb not null default '{}'::jsonb,     -- id/url per locale
  external_url text,
  updated_at timestamptz not null default now()
);
create trigger lesson_contents_updated_at before update on public.lesson_contents
  for each row execute function public.set_updated_at();

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title jsonb not null,
  kind text not null default 'file' check (kind in ('file', 'link')),
  storage_path text,
  url text,
  locale text check (locale is null or locale ~ '^[a-z]{2}$'), -- null = all languages
  mime_type text,
  file_size bigint,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'file' and storage_path is not null) or (kind = 'link' and url is not null))
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, position);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  instructions jsonb not null default '{}'::jsonb,
  submission_type text not null default 'any' check (submission_type in ('text', 'file', 'link', 'any')),
  is_required boolean not null default true,
  requires_review boolean not null default true,
  max_score int not null default 100 check (max_score > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enrollments & payments
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  status public.enrollment_status not null default 'pending',
  source text not null default 'self' check (source in ('self', 'admin', 'gateway')),
  access_days int not null default 90 check (access_days between 1 and 3650),
  extended_days int not null default 0,
  requested_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  last_lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (activated_at is not null and expires_at is not null))
);
-- one open (pending/active) enrollment per student per course
create unique index enrollments_open_unique on public.enrollments (student_id, course_id)
  where status in ('pending', 'active');
create index enrollments_student_idx on public.enrollments (student_id);
create index enrollments_course_idx on public.enrollments (course_id);
create index enrollments_expiry_idx on public.enrollments (expires_at) where status = 'active';
create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'SRD',
  payment_date date,
  reference text,
  status public.payment_status not null default 'pending',
  student_note text,
  admin_notes text,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  refunded_at timestamptz,
  provider text not null default 'manual',
  provider_payment_id text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_status_idx on public.payments (status, submitted_at desc);
create index payments_student_idx on public.payments (student_id);
create index payments_enrollment_idx on public.payments (enrollment_id);
create unique index payments_provider_unique on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_evidence_payment_idx on public.payment_evidence (payment_id);

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  first_accessed_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  resource_accessed_at timestamptz,
  completed_at timestamptz,
  primary key (student_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (student_id, course_id);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  text_answer text,
  link_url text,
  storage_path text,
  file_name text,
  status public.submission_status not null default 'submitted',
  score int,
  feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  unique (assignment_id, student_id)
);
create index assignment_submissions_status_idx on public.assignment_submissions (status, submitted_at);

-- ---------------------------------------------------------------------------
-- Quizzes & exams
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid unique references public.lessons (id) on delete set null,
  kind public.quiz_kind not null default 'quiz',
  title jsonb not null,
  instructions jsonb not null default '{}'::jsonb,
  passing_score int not null default 70 check (passing_score between 1 and 100),
  time_limit_minutes int check (time_limit_minutes > 0),
  max_attempts int check (max_attempts > 0),           -- null = unlimited
  question_count int check (question_count > 0),       -- null = all questions
  shuffle_questions boolean not null default true,
  retake_wait_hours int not null default 0 check (retake_wait_hours >= 0),
  show_correct_answers boolean not null default true,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quizzes_one_final_exam on public.quizzes (course_id) where kind = 'final_exam';
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  type public.question_type not null default 'single_choice',
  prompt jsonb not null,
  explanation jsonb not null default '{}'::jsonb,
  accepted_answers jsonb not null default '{}'::jsonb, -- short answer: {"nl": [...], "en": [...]}
  points numeric(6, 2) not null default 1 check (points > 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label jsonb not null,
  is_correct boolean not null default false,
  position int not null default 0
);
create index quiz_options_question_idx on public.quiz_options (question_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  attempt_number int not null default 1,
  status public.attempt_status not null default 'in_progress',
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  score numeric(8, 2),
  max_score numeric(8, 2),
  percentage numeric(5, 2),
  passed boolean,
  locale text not null default 'nl',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  unique (quiz_id, student_id, attempt_number)
);
create unique index quiz_attempts_one_open on public.quiz_attempts (quiz_id, student_id)
  where status = 'in_progress';
create index quiz_attempts_student_idx on public.quiz_attempts (student_id, course_id);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  recipient_name text not null,
  course_title jsonb not null,
  locale text not null default 'nl',
  final_score numeric(5, 2),
  completion_date date not null default current_date,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null,
  status public.certificate_status not null default 'valid',
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by uuid references public.profiles (id) on delete set null,
  replaces_id uuid references public.certificates (id) on delete set null
);
create unique index certificates_one_valid on public.certificates (student_id, course_id)
  where status = 'valid';
create index certificates_student_idx on public.certificates (student_id);

-- ---------------------------------------------------------------------------
-- Notifications, email, audit
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  locale text not null check (locale ~ '^[a-z]{2}$'),
  subject text not null,
  body text not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (key, locale)
);
create trigger email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  template text not null,
  locale text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);

create table public.enrollment_reminders (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (enrollment_id, kind)
);

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  locale text not null default 'nl',
  handled_at timestamptz,
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
