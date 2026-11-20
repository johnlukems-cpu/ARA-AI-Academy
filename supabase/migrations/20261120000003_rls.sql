-- ARA AI Academy – Row Level Security
-- Students only ever see their own private records. Admin access is checked with public.is_admin().
-- Workflow mutations (enrollment, payments, progress, certificates) go through SECURITY DEFINER functions;
-- students have no direct insert/update rights on those tables.

alter table public.profiles enable row level security;
alter table public.academy_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.courses enable row level security;
alter table public.course_translations enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_contents enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.assignments enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_evidence enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_log enable row level security;
alter table public.enrollment_reminders enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contact_messages enable row level security;
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Column-level protection: nobody can change role/status/email through the API.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, country, preferred_locale, avatar_url, last_seen_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Settings: public columns readable by everyone, writes by admins
-- ---------------------------------------------------------------------------
revoke all on public.academy_settings from anon, authenticated;
grant select (id, academy_name, company_name, logo_url, contact_email, contact_phone, contact_whatsapp, address,
              currency, supported_currencies, default_access_days, default_passing_score, enabled_locales,
              default_locale, enrollment_open, reminder_days, certificate_signatory_name,
              certificate_signatory_title, certificate_signature_url, certificate_accent_color, certificate_footer,
              updated_at)
  on public.academy_settings to anon, authenticated;
grant update on public.academy_settings to authenticated;
create policy settings_select_all on public.academy_settings for select to anon, authenticated using (true);
create policy settings_update_admin on public.academy_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Catalog & content
-- ---------------------------------------------------------------------------
create policy payment_methods_select on public.payment_methods
  for select to anon, authenticated using (is_active or public.is_admin());
create policy payment_methods_admin on public.payment_methods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy courses_select on public.courses
  for select to anon, authenticated using (public.can_view_course(id));
create policy courses_admin on public.courses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy course_translations_select on public.course_translations
  for select to anon, authenticated using (public.can_view_course(course_id));
create policy course_translations_admin on public.course_translations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy course_modules_select on public.course_modules
  for select to anon, authenticated using (public.can_view_course(course_id));
create policy course_modules_admin on public.course_modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lessons_select on public.lessons
  for select to anon, authenticated
  using ((status = 'published' and public.can_view_course(course_id)) or public.is_admin());
create policy lessons_admin on public.lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Protected content: active (non-expired) access, free preview lessons, or admin.
create policy lesson_contents_select on public.lesson_contents
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.lessons l
       where l.id = lesson_id and l.status = 'published'
         and (public.has_course_access(l.course_id)
              or (l.is_preview and exists (select 1 from public.courses c where c.id = l.course_id and c.status = 'published')))
    )
  );
create policy lesson_contents_admin on public.lesson_contents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Resource metadata is visible with the outline; files are only served via short-lived signed URLs
-- after a server-side access check.
create policy lesson_resources_select on public.lesson_resources
  for select to authenticated using (public.has_course_access(course_id) or public.is_admin());
create policy lesson_resources_admin on public.lesson_resources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assignments_select on public.assignments
  for select to authenticated using (public.has_course_access(course_id) or public.is_admin());
create policy assignments_admin on public.assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy quizzes_select on public.quizzes
  for select to authenticated
  using ((status = 'published' and public.can_view_course(course_id)) or public.is_admin());
create policy quizzes_admin on public.quizzes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Questions & options contain the answer key: admins only. Students receive sanitized
-- questions from the server.
create policy quiz_questions_admin on public.quiz_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy quiz_options_admin on public.quiz_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Private student records (read own; admins read all; writes via functions)
-- ---------------------------------------------------------------------------
create policy enrollments_select on public.enrollments
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.enrollments from anon, authenticated;

create policy payments_select on public.payments
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy payments_update_admin_notes on public.payments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.payments from anon, authenticated;
grant update (admin_notes) on public.payments to authenticated;

create policy payment_evidence_select on public.payment_evidence
  for select to authenticated
  using (public.is_admin() or exists (select 1 from public.payments p where p.id = payment_id and p.student_id = auth.uid()));
revoke insert, update, delete on public.payment_evidence from anon, authenticated;

create policy lesson_progress_select on public.lesson_progress
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.lesson_progress from anon, authenticated;

create policy assignment_submissions_select on public.assignment_submissions
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.assignment_submissions from anon, authenticated;

create policy quiz_attempts_select on public.quiz_attempts
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;

create policy certificates_select on public.certificates
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.certificates from anon, authenticated;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-only tables
-- ---------------------------------------------------------------------------
create policy email_templates_admin on public.email_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy email_log_admin on public.email_log
  for select to authenticated using (public.is_admin());
create policy enrollment_reminders_admin on public.enrollment_reminders
  for select to authenticated using (public.is_admin());
create policy audit_logs_admin on public.audit_logs
  for select to authenticated using (public.is_admin());
create policy contact_messages_admin_select on public.contact_messages
  for select to authenticated using (public.is_admin());
create policy contact_messages_admin_update on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.email_log, public.enrollment_reminders, public.audit_logs from anon, authenticated;
revoke insert, delete on public.contact_messages from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
