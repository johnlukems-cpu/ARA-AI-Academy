-- ARA AI Academy – business logic functions
-- Every SECURITY DEFINER function pins search_path and performs its own authorization.

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.student_id = auth.uid()
      and e.course_id = p_course_id
      and e.status = 'active'
      and e.expires_at > now()
      and p.status = 'active'
  );
$$;

create or replace function public.can_view_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.courses c where c.id = p_course_id and c.status = 'published')
      or exists (select 1 from public.enrollments e where e.course_id = p_course_id and e.student_id = auth.uid())
      or public.is_admin();
$$;

-- internal: may the caller act for this student? (self, admin or service role)
create or replace function public._can_act_for(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (auth.uid() is not null and auth.uid() = p_student) or public.is_admin() or public.is_service_role();
$$;

-- ---------------------------------------------------------------------------
-- New user → profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, first_name, last_name, phone, country, preferred_locale, terms_accepted_at)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(m ->> 'first_name', ''), 100),
    left(coalesce(m ->> 'last_name', ''), 100),
    left(m ->> 'phone', 40),
    coalesce(nullif(left(m ->> 'country', 56), ''), 'SR'),
    case when m ->> 'preferred_locale' in ('nl', 'en') then m ->> 'preferred_locale' else 'nl' end,
    case when m ->> 'terms_accepted' = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Internal helpers: audit + notifications
-- ---------------------------------------------------------------------------
create or replace function public._audit(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public._notify(p_user uuid, p_type text, p_payload jsonb default '{}'::jsonb, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, payload, link)
  values (p_user, p_type, coalesce(p_payload, '{}'::jsonb), p_link);
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Called by the server with the service role.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- ---------------------------------------------------------------------------
-- Student: enrollment request & payment submission
-- ---------------------------------------------------------------------------
create or replace function public.request_enrollment(p_course_id uuid)
returns public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_course public.courses;
  v_profile public.profiles;
  v_enr public.enrollments;
  v_open boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.status <> 'active' then raise exception 'account_inactive' using errcode = '42501'; end if;

  select enrollment_open into v_open from public.academy_settings where id = 1;
  select * into v_course from public.courses where id = p_course_id;
  if not found or v_course.status <> 'published' then raise exception 'course_unavailable'; end if;
  if not v_course.enrollment_open or not coalesce(v_open, true) then raise exception 'enrollment_closed'; end if;

  select * into v_enr from public.enrollments
  where student_id = auth.uid() and course_id = p_course_id and status in ('pending', 'active');
  if found then
    return v_enr; -- idempotent: return the open enrollment
  end if;

  insert into public.enrollments (student_id, course_id, status, source, access_days)
  values (auth.uid(), p_course_id, 'pending', 'self', v_course.access_days)
  returning * into v_enr;

  perform public._audit('enrollment.requested', 'enrollment', v_enr.id::text, jsonb_build_object('course_id', p_course_id));
  perform public._notify(auth.uid(), 'enrollment_submitted', jsonb_build_object('course_id', p_course_id, 'enrollment_id', v_enr.id));
  return v_enr;
end $$;

create or replace function public.cancel_enrollment_request(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_enr public.enrollments;
begin
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found or v_enr.student_id <> auth.uid() then raise exception 'not_found'; end if;
  if v_enr.status <> 'pending' then raise exception 'not_pending'; end if;
  if exists (select 1 from public.payments where enrollment_id = p_enrollment_id and status = 'pending') then
    raise exception 'payment_under_review';
  end if;
  update public.enrollments set status = 'cancelled' where id = p_enrollment_id;
  perform public._audit('enrollment.cancelled', 'enrollment', p_enrollment_id::text, '{}'::jsonb);
end $$;

create or replace function public.submit_payment(
  p_enrollment_id uuid,
  p_payment_method_id uuid,
  p_payment_date date,
  p_reference text,
  p_note text default null,
  p_evidence jsonb default '[]'::jsonb -- [{storage_path, file_name, mime_type, file_size}]
)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_enr public.enrollments;
  v_course public.courses;
  v_method public.payment_methods;
  v_pay public.payments;
  v_item jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found or v_enr.student_id <> auth.uid() then raise exception 'not_found'; end if;
  if v_enr.status <> 'pending' then raise exception 'enrollment_not_pending'; end if;
  if exists (select 1 from public.payments where enrollment_id = p_enrollment_id and status = 'pending') then
    raise exception 'payment_already_pending';
  end if;

  select * into v_method from public.payment_methods where id = p_payment_method_id and is_active;
  if not found then raise exception 'invalid_payment_method'; end if;
  if v_method.requires_reference and coalesce(btrim(p_reference), '') = '' then raise exception 'reference_required'; end if;
  if v_method.requires_proof and jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
    raise exception 'proof_required';
  end if;
  if p_payment_date is not null and p_payment_date > current_date + 1 then raise exception 'invalid_payment_date'; end if;

  select * into v_course from public.courses where id = v_enr.course_id;

  insert into public.payments (enrollment_id, student_id, course_id, payment_method_id, amount, currency,
                               payment_date, reference, student_note, provider)
  values (v_enr.id, auth.uid(), v_enr.course_id, v_method.id, v_course.price, v_course.currency,
          p_payment_date, left(btrim(p_reference), 120), left(p_note, 1000), v_method.provider)
  returning * into v_pay;

  for v_item in select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    if position((auth.uid()::text || '/') in (v_item ->> 'storage_path')) <> 1 then
      raise exception 'invalid_evidence_path';
    end if;
    insert into public.payment_evidence (payment_id, storage_path, file_name, mime_type, file_size, uploaded_by)
    values (v_pay.id, v_item ->> 'storage_path', left(coalesce(v_item ->> 'file_name', 'proof'), 200),
            v_item ->> 'mime_type', nullif(v_item ->> 'file_size', '')::bigint, auth.uid());
  end loop;

  perform public._audit('payment.submitted', 'payment', v_pay.id::text,
                        jsonb_build_object('enrollment_id', v_enr.id, 'amount', v_pay.amount));
  return v_pay;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: payment review
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_payment(p_payment_id uuid, p_notes text default null)
returns public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_enr public.enrollments;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_pay.status <> 'pending' then raise exception 'payment_not_pending'; end if;

  select * into v_enr from public.enrollments where id = v_pay.enrollment_id for update;
  if v_enr.status <> 'pending' then raise exception 'enrollment_not_pending'; end if;

  update public.payments
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
         admin_notes = coalesce(nullif(btrim(p_notes), ''), admin_notes)
   where id = p_payment_id;

  update public.enrollments
     set status = 'active', activated_at = now(),
         expires_at = now() + make_interval(days => access_days)
   where id = v_enr.id
  returning * into v_enr;

  perform public._audit('payment.approved', 'payment', p_payment_id::text,
                        jsonb_build_object('enrollment_id', v_enr.id, 'expires_at', v_enr.expires_at));
  perform public._notify(v_enr.student_id, 'payment_approved',
                         jsonb_build_object('course_id', v_enr.course_id, 'enrollment_id', v_enr.id, 'expires_at', v_enr.expires_at));
  return v_enr;
end $$;

create or replace function public.admin_reject_payment(p_payment_id uuid, p_reason text, p_notes text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_pay.status <> 'pending' then raise exception 'payment_not_pending'; end if;

  update public.payments
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
         rejection_reason = left(p_reason, 1000),
         admin_notes = coalesce(nullif(btrim(p_notes), ''), admin_notes)
   where id = p_payment_id
  returning * into v_pay;

  perform public._audit('payment.rejected', 'payment', p_payment_id::text, jsonb_build_object('reason', p_reason));
  perform public._notify(v_pay.student_id, 'payment_rejected',
                         jsonb_build_object('course_id', v_pay.course_id, 'enrollment_id', v_pay.enrollment_id, 'reason', p_reason));
  return v_pay;
end $$;

create or replace function public.admin_refund_payment(p_payment_id uuid, p_revoke_access boolean, p_notes text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_pay.status <> 'approved' then raise exception 'payment_not_approved'; end if;

  update public.payments
     set status = 'refunded', refunded_at = now(),
         admin_notes = coalesce(nullif(btrim(p_notes), ''), admin_notes)
   where id = p_payment_id
  returning * into v_pay;

  if p_revoke_access then
    update public.enrollments
       set status = 'revoked', revoked_at = now(), revoked_reason = 'refund'
     where id = v_pay.enrollment_id and status in ('active', 'pending');
  end if;

  perform public._audit('payment.refunded', 'payment', p_payment_id::text, jsonb_build_object('revoked', p_revoke_access));
  return v_pay;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: enrollment management
-- ---------------------------------------------------------------------------
create or replace function public.admin_extend_enrollment(p_enrollment_id uuid, p_days int, p_reason text default null)
returns public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_enr public.enrollments;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'invalid_days'; end if;
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_enr.status not in ('active', 'expired') then raise exception 'enrollment_not_extendable'; end if;

  update public.enrollments
     set status = 'active',
         expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => p_days),
         extended_days = extended_days + p_days
   where id = p_enrollment_id
  returning * into v_enr;

  delete from public.enrollment_reminders where enrollment_id = p_enrollment_id;

  perform public._audit('enrollment.extended', 'enrollment', p_enrollment_id::text,
                        jsonb_build_object('days', p_days, 'reason', p_reason, 'expires_at', v_enr.expires_at));
  perform public._notify(v_enr.student_id, 'access_extended',
                         jsonb_build_object('course_id', v_enr.course_id, 'days', p_days, 'expires_at', v_enr.expires_at));
  return v_enr;
end $$;

create or replace function public.admin_revoke_enrollment(p_enrollment_id uuid, p_reason text)
returns public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_enr public.enrollments;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_enr.status not in ('active', 'pending', 'expired') then raise exception 'enrollment_not_revocable'; end if;

  update public.enrollments
     set status = 'revoked', revoked_at = now(), revoked_reason = left(p_reason, 500)
   where id = p_enrollment_id
  returning * into v_enr;

  perform public._audit('enrollment.revoked', 'enrollment', p_enrollment_id::text, jsonb_build_object('reason', p_reason));
  perform public._notify(v_enr.student_id, 'access_revoked', jsonb_build_object('course_id', v_enr.course_id));
  return v_enr;
end $$;

create or replace function public.admin_manual_enroll(
  p_student_id uuid,
  p_course_id uuid,
  p_days int default null,
  p_amount numeric default null,
  p_payment_method_id uuid default null,
  p_reference text default null,
  p_note text default null
)
returns public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_course public.courses;
  v_enr public.enrollments;
  v_days int;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course_not_found'; end if;
  if not exists (select 1 from public.profiles where id = p_student_id) then raise exception 'student_not_found'; end if;
  v_days := coalesce(p_days, v_course.access_days);
  if v_days < 1 or v_days > 3650 then raise exception 'invalid_days'; end if;

  select * into v_enr from public.enrollments
   where student_id = p_student_id and course_id = p_course_id and status in ('pending', 'active')
   for update;

  if found and v_enr.status = 'active' then raise exception 'already_active'; end if;

  if found then
    update public.enrollments
       set status = 'active', source = 'admin', access_days = v_days, activated_at = now(),
           expires_at = now() + make_interval(days => v_days)
     where id = v_enr.id
    returning * into v_enr;
  else
    insert into public.enrollments (student_id, course_id, status, source, access_days, activated_at, expires_at)
    values (p_student_id, p_course_id, 'active', 'admin', v_days, now(), now() + make_interval(days => v_days))
    returning * into v_enr;
  end if;

  if p_amount is not null then
    insert into public.payments (enrollment_id, student_id, course_id, payment_method_id, amount, currency,
                                 payment_date, reference, status, admin_notes, reviewed_by, reviewed_at)
    values (v_enr.id, p_student_id, p_course_id, p_payment_method_id, p_amount, v_course.currency,
            current_date, p_reference, 'approved', p_note, auth.uid(), now());
  end if;

  perform public._audit('enrollment.manual', 'enrollment', v_enr.id::text,
                        jsonb_build_object('student_id', p_student_id, 'course_id', p_course_id, 'days', v_days, 'note', p_note));
  perform public._notify(p_student_id, 'access_activated',
                         jsonb_build_object('course_id', p_course_id, 'enrollment_id', v_enr.id, 'expires_at', v_enr.expires_at));
  return v_enr;
end $$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_self'; end if;
  update public.profiles
     set status = p_status,
         suspended_reason = case when p_status = 'suspended' then left(p_reason, 500) else null end
   where id = p_user_id
  returning * into v_profile;
  if not found then raise exception 'not_found'; end if;
  perform public._audit('user.status', 'profile', p_user_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
  return v_profile;
end $$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_self'; end if;
  update public.profiles set role = p_role where id = p_user_id returning * into v_profile;
  if not found then raise exception 'not_found'; end if;
  perform public._audit('user.role', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
  return v_profile;
end $$;

-- Daily job: expire enrollments whose access period has ended.
create or replace function public.expire_enrollments()
returns setof public.enrollments language plpgsql security definer set search_path = '' as $$
declare
  v_enr public.enrollments;
begin
  if not (public.is_service_role() or public.is_admin()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  for v_enr in
    update public.enrollments set status = 'expired'
     where status = 'active' and expires_at <= now()
    returning *
  loop
    perform public._notify(v_enr.student_id, 'access_expired', jsonb_build_object('course_id', v_enr.course_id, 'enrollment_id', v_enr.id));
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (null, 'enrollment.expired', 'enrollment', v_enr.id::text, '{}'::jsonb);
    return next v_enr;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
create or replace function public.record_lesson_access(p_lesson_id uuid, p_resource boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id and status = 'published';
  if not found then raise exception 'not_found'; end if;
  if not public.has_course_access(v_lesson.course_id) then
    if v_lesson.is_preview then return; end if;
    raise exception 'no_access' using errcode = '42501';
  end if;

  insert into public.lesson_progress as lp (student_id, lesson_id, course_id, resource_accessed_at)
  values (auth.uid(), p_lesson_id, v_lesson.course_id, case when p_resource then now() end)
  on conflict (student_id, lesson_id) do update
    set last_accessed_at = now(),
        resource_accessed_at = coalesce(lp.resource_accessed_at, excluded.resource_accessed_at);

  update public.enrollments set last_lesson_id = p_lesson_id
   where student_id = auth.uid() and course_id = v_lesson.course_id and status = 'active';
end $$;

-- Marks a lesson complete only when its required content was actually accessed.
create or replace function public.complete_lesson(p_lesson_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons;
  v_progress public.lesson_progress;
  v_done timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id and status = 'published';
  if not found then raise exception 'not_found'; end if;
  if not public.has_course_access(v_lesson.course_id) then raise exception 'no_access' using errcode = '42501'; end if;

  select * into v_progress from public.lesson_progress where student_id = auth.uid() and lesson_id = p_lesson_id;
  if not found then raise exception 'content_not_accessed'; end if;
  if v_progress.completed_at is not null then return v_progress.completed_at; end if;

  if v_lesson.type = 'pdf'
     and exists (select 1 from public.lesson_resources r where r.lesson_id = p_lesson_id)
     and v_progress.resource_accessed_at is null then
    raise exception 'resource_not_opened';
  end if;

  if v_lesson.type = 'quiz' and not exists (
       select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
        where q.lesson_id = p_lesson_id and a.student_id = auth.uid() and a.passed) then
    raise exception 'quiz_not_passed';
  end if;

  if v_lesson.type = 'assignment' and not exists (
       select 1 from public.assignment_submissions s join public.assignments asg on asg.id = s.assignment_id
        where asg.lesson_id = p_lesson_id and s.student_id = auth.uid() and s.status in ('submitted', 'approved')) then
    raise exception 'assignment_not_submitted';
  end if;

  update public.lesson_progress set completed_at = now(), last_accessed_at = now()
   where student_id = auth.uid() and lesson_id = p_lesson_id
  returning completed_at into v_done;

  perform public._try_issue_certificate(auth.uid(), v_lesson.course_id);
  return v_done;
end $$;

create or replace function public.course_progress(p_student uuid, p_course uuid)
returns table (total_lessons int, completed_lessons int, mandatory_total int, mandatory_completed int, percentage int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_act_for(p_student) then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with ls as (
    select l.id, l.is_mandatory, (lp.completed_at is not null) as done
      from public.lessons l
      left join public.lesson_progress lp on lp.lesson_id = l.id and lp.student_id = p_student
     where l.course_id = p_course and l.status = 'published'
  )
  select count(*)::int,
         count(*) filter (where done)::int,
         count(*) filter (where is_mandatory)::int,
         count(*) filter (where is_mandatory and done)::int,
         case when count(*) = 0 then 0 else floor(100.0 * count(*) filter (where done) / count(*))::int end
    from ls;
end $$;

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
create or replace function public.submit_assignment(
  p_assignment_id uuid, p_text text, p_link text, p_storage_path text, p_file_name text
)
returns public.assignment_submissions language plpgsql security definer set search_path = '' as $$
declare
  v_asg public.assignments;
  v_sub public.assignment_submissions;
  v_enr uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_asg from public.assignments where id = p_assignment_id;
  if not found then raise exception 'not_found'; end if;
  if not public.has_course_access(v_asg.course_id) then raise exception 'no_access' using errcode = '42501'; end if;
  if coalesce(btrim(p_text), '') = '' and coalesce(btrim(p_link), '') = '' and p_storage_path is null then
    raise exception 'submission_empty';
  end if;
  if p_storage_path is not null and position((auth.uid()::text || '/') in p_storage_path) <> 1 then
    raise exception 'invalid_file_path';
  end if;
  if exists (select 1 from public.assignment_submissions
              where assignment_id = p_assignment_id and student_id = auth.uid() and status = 'approved') then
    raise exception 'already_approved';
  end if;

  select id into v_enr from public.enrollments
   where student_id = auth.uid() and course_id = v_asg.course_id and status = 'active' limit 1;

  insert into public.assignment_submissions as s
    (assignment_id, student_id, course_id, enrollment_id, text_answer, link_url, storage_path, file_name, status)
  values (p_assignment_id, auth.uid(), v_asg.course_id, v_enr, left(p_text, 20000), left(p_link, 1000),
          p_storage_path, left(p_file_name, 200),
          case when v_asg.requires_review then 'submitted'::public.submission_status else 'approved'::public.submission_status end)
  on conflict (assignment_id, student_id) do update
    set text_answer = excluded.text_answer, link_url = excluded.link_url,
        storage_path = coalesce(excluded.storage_path, s.storage_path),
        file_name = coalesce(excluded.file_name, s.file_name),
        status = excluded.status, score = null, feedback = null,
        reviewed_by = null, reviewed_at = null, submitted_at = now()
  returning * into v_sub;

  -- record access and complete the assignment lesson
  insert into public.lesson_progress as lp (student_id, lesson_id, course_id, completed_at)
  values (auth.uid(), v_asg.lesson_id, v_asg.course_id, now())
  on conflict (student_id, lesson_id) do update
    set completed_at = coalesce(lp.completed_at, now()), last_accessed_at = now();

  perform public._try_issue_certificate(auth.uid(), v_asg.course_id);
  return v_sub;
end $$;

create or replace function public.admin_review_submission(
  p_submission_id uuid, p_status public.submission_status, p_score int, p_feedback text
)
returns public.assignment_submissions language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.assignment_submissions;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status = 'submitted' then raise exception 'invalid_status'; end if;
  update public.assignment_submissions
     set status = p_status, score = p_score, feedback = left(p_feedback, 5000),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_submission_id
  returning * into v_sub;
  if not found then raise exception 'not_found'; end if;

  if p_status = 'needs_revision' then
    update public.lesson_progress lp set completed_at = null
      from public.assignments a
     where a.id = v_sub.assignment_id and lp.lesson_id = a.lesson_id and lp.student_id = v_sub.student_id;
  end if;

  perform public._audit('assignment.reviewed', 'assignment_submission', p_submission_id::text,
                        jsonb_build_object('status', p_status, 'score', p_score));
  perform public._notify(v_sub.student_id, 'assignment_reviewed',
                         jsonb_build_object('course_id', v_sub.course_id, 'status', p_status, 'assignment_id', v_sub.assignment_id));
  if p_status = 'approved' then
    perform public._try_issue_certificate(v_sub.student_id, v_sub.course_id);
  end if;
  return v_sub;
end $$;

-- ---------------------------------------------------------------------------
-- Completion rules & certificates
-- ---------------------------------------------------------------------------
create or replace function public._completion_status(p_student uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_course public.courses;
  v_lessons_total int; v_lessons_done int;
  v_asg_total int; v_asg_done int;
  v_exam_id uuid; v_exam_passed boolean := false; v_exam_best numeric;
  v_lessons_ok boolean; v_asg_ok boolean; v_exam_ok boolean;
begin
  select * into v_course from public.courses where id = p_course;
  if not found then raise exception 'not_found'; end if;

  select count(*), count(*) filter (where lp.completed_at is not null)
    into v_lessons_total, v_lessons_done
    from public.lessons l
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.student_id = p_student
   where l.course_id = p_course and l.status = 'published' and l.is_mandatory;

  select count(*),
         count(*) filter (where (a.requires_review and s.status = 'approved')
                             or (not a.requires_review and s.status in ('submitted', 'approved')))
    into v_asg_total, v_asg_done
    from public.assignments a
    join public.lessons l on l.id = a.lesson_id and l.status = 'published'
    left join public.assignment_submissions s on s.assignment_id = a.id and s.student_id = p_student
   where a.course_id = p_course and a.is_required;

  select id into v_exam_id from public.quizzes
   where course_id = p_course and kind = 'final_exam' and status = 'published';
  if v_exam_id is not null then
    select coalesce(bool_or(passed), false), max(percentage) into v_exam_passed, v_exam_best
      from public.quiz_attempts where quiz_id = v_exam_id and student_id = p_student and status = 'submitted';
  end if;

  v_lessons_ok := not v_course.require_all_mandatory_lessons or v_lessons_done >= v_lessons_total;
  v_asg_ok := not v_course.require_assignments or v_asg_done >= v_asg_total;
  v_exam_ok := not v_course.require_final_exam or (v_exam_id is not null and v_exam_passed);

  return jsonb_build_object(
    'lessons_total', v_lessons_total, 'lessons_done', v_lessons_done, 'lessons_ok', v_lessons_ok,
    'assignments_total', v_asg_total, 'assignments_done', v_asg_done, 'assignments_ok', v_asg_ok,
    'exam_required', v_course.require_final_exam, 'exam_available', v_exam_id is not null,
    'exam_passed', v_exam_passed, 'exam_best', v_exam_best, 'exam_ok', v_exam_ok,
    'certificate_enabled', v_course.certificate_enabled,
    'eligible', v_course.certificate_enabled and v_lessons_ok and v_asg_ok and v_exam_ok
  );
end $$;

create or replace function public.completion_status(p_student uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_act_for(p_student) then raise exception 'not_authorized' using errcode = '42501'; end if;
  return public._completion_status(p_student, p_course);
end $$;

create or replace function public.generate_certificate_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
  i int;
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return 'ARA-' || to_char(now(), 'YYYY') || '-' || result;
end $$;

-- internal: issue certificate if eligible; returns certificate id or null
create or replace function public._try_issue_certificate(p_student uuid, p_course uuid, p_issued_by uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_status jsonb;
  v_existing uuid;
  v_profile public.profiles;
  v_enr public.enrollments;
  v_title jsonb;
  v_code text;
  v_id uuid;
begin
  select id into v_existing from public.certificates
   where student_id = p_student and course_id = p_course and status = 'valid';
  if v_existing is not null then return v_existing; end if;

  v_status := public._completion_status(p_student, p_course);
  if not (v_status ->> 'eligible')::boolean then return null; end if;

  select * into v_profile from public.profiles where id = p_student;
  select * into v_enr from public.enrollments
   where student_id = p_student and course_id = p_course and status in ('active', 'expired')
   order by activated_at desc nulls last limit 1;
  if not found then return null; end if;

  select coalesce(jsonb_object_agg(locale, title), '{}'::jsonb) into v_title
    from public.course_translations where course_id = p_course;

  loop
    v_code := public.generate_certificate_code();
    exit when not exists (select 1 from public.certificates where code = v_code);
  end loop;

  insert into public.certificates (code, student_id, course_id, enrollment_id, recipient_name, course_title,
                                   locale, final_score, issued_by)
  values (v_code, p_student, p_course, v_enr.id,
          btrim(v_profile.first_name || ' ' || v_profile.last_name), v_title,
          v_profile.preferred_locale, nullif(v_status ->> 'exam_best', '')::numeric, p_issued_by)
  returning id into v_id;

  update public.enrollments set completed_at = coalesce(completed_at, now()) where id = v_enr.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'certificate.issued', 'certificate', v_id::text, jsonb_build_object('code', v_code));
  perform public._notify(p_student, 'certificate_issued', jsonb_build_object('course_id', p_course, 'code', v_code));
  return v_id;
end $$;

create or replace function public.try_issue_certificate(p_student uuid, p_course uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public._can_act_for(p_student) then raise exception 'not_authorized' using errcode = '42501'; end if;
  return public._try_issue_certificate(p_student, p_course, case when public.is_admin() then auth.uid() end);
end $$;

create or replace function public.admin_revoke_certificate(p_certificate_id uuid, p_reason text)
returns public.certificates language plpgsql security definer set search_path = '' as $$
declare
  v_cert public.certificates;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  update public.certificates
     set status = 'revoked', revoked_at = now(), revoked_reason = left(p_reason, 500), revoked_by = auth.uid()
   where id = p_certificate_id and status = 'valid'
  returning * into v_cert;
  if not found then raise exception 'not_found'; end if;
  perform public._audit('certificate.revoked', 'certificate', p_certificate_id::text, jsonb_build_object('reason', p_reason));
  return v_cert;
end $$;

-- Reissue: revoke the current certificate and issue a new one with the current
-- profile name (e.g. after a name correction). Requirements are not re-checked.
create or replace function public.admin_reissue_certificate(p_certificate_id uuid)
returns public.certificates language plpgsql security definer set search_path = '' as $$
declare
  v_old public.certificates;
  v_new public.certificates;
  v_profile public.profiles;
  v_title jsonb;
  v_code text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_old from public.certificates where id = p_certificate_id for update;
  if not found then raise exception 'not_found'; end if;

  update public.certificates
     set status = 'revoked', revoked_at = coalesce(revoked_at, now()),
         revoked_reason = coalesce(revoked_reason, 'reissued'), revoked_by = coalesce(revoked_by, auth.uid())
   where id = v_old.id;

  select * into v_profile from public.profiles where id = v_old.student_id;
  select coalesce(jsonb_object_agg(locale, title), v_old.course_title) into v_title
    from public.course_translations where course_id = v_old.course_id;

  loop
    v_code := public.generate_certificate_code();
    exit when not exists (select 1 from public.certificates where code = v_code);
  end loop;

  insert into public.certificates (code, student_id, course_id, enrollment_id, recipient_name, course_title, locale,
                                   final_score, completion_date, issued_by, replaces_id)
  values (v_code, v_old.student_id, v_old.course_id, v_old.enrollment_id,
          btrim(v_profile.first_name || ' ' || v_profile.last_name), v_title, v_profile.preferred_locale,
          v_old.final_score, v_old.completion_date, auth.uid(), v_old.id)
  returning * into v_new;

  perform public._audit('certificate.reissued', 'certificate', v_new.id::text,
                        jsonb_build_object('replaces', v_old.code, 'code', v_code));
  perform public._notify(v_new.student_id, 'certificate_issued', jsonb_build_object('course_id', v_new.course_id, 'code', v_code));
  return v_new;
end $$;

-- Public verification (anon). Returns only non-sensitive fields.
create or replace function public.verify_certificate(p_code text)
returns table (code text, recipient_name text, course_title jsonb, completion_date date, issued_at timestamptz,
               status public.certificate_status, revoked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.code, c.recipient_name, c.course_title, c.completion_date, c.issued_at, c.status, c.revoked_at
    from public.certificates c
   where c.code = upper(btrim(p_code));
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard statistics
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_students', (select count(*) from public.profiles where role = 'student'),
    'active_students', (select count(distinct student_id) from public.enrollments where status = 'active' and expires_at > now()),
    'pending_enrollments', (select count(*) from public.enrollments where status = 'pending'),
    'pending_payments', (select count(*) from public.payments where status = 'pending'),
    'approved_payments', (select count(*) from public.payments where status = 'approved'),
    'revenue', (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
                  from (select currency, sum(amount) as total from public.payments where status = 'approved' group by currency) r),
    'active_courses', (select count(*) from public.courses where status = 'published'),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'activated_enrollments', (select count(*) from public.enrollments where activated_at is not null),
    'completed_enrollments', (select count(*) from public.enrollments where completed_at is not null),
    'certificates_issued', (select count(*) from public.certificates where status = 'valid'),
    'expired_enrollments', (select count(*) from public.enrollments where status = 'expired'),
    'submissions_to_review', (select count(*) from public.assignment_submissions where status = 'submitted')
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_service_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.has_course_access(uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_course(uuid) to anon, authenticated, service_role;
grant execute on function public._can_act_for(uuid) to authenticated, service_role;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

grant execute on function public.request_enrollment(uuid) to authenticated;
grant execute on function public.cancel_enrollment_request(uuid) to authenticated;
grant execute on function public.submit_payment(uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.record_lesson_access(uuid, boolean) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.course_progress(uuid, uuid) to authenticated, service_role;
grant execute on function public.completion_status(uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_assignment(uuid, text, text, text, text) to authenticated;
grant execute on function public.try_issue_certificate(uuid, uuid) to authenticated, service_role;

grant execute on function public.admin_approve_payment(uuid, text) to authenticated;
grant execute on function public.admin_reject_payment(uuid, text, text) to authenticated;
grant execute on function public.admin_refund_payment(uuid, boolean, text) to authenticated;
grant execute on function public.admin_extend_enrollment(uuid, int, text) to authenticated;
grant execute on function public.admin_revoke_enrollment(uuid, text) to authenticated;
grant execute on function public.admin_manual_enroll(uuid, uuid, int, numeric, uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_review_submission(uuid, public.submission_status, int, text) to authenticated;
grant execute on function public.admin_revoke_certificate(uuid, text) to authenticated;
grant execute on function public.admin_reissue_certificate(uuid) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

grant execute on function public.expire_enrollments() to authenticated, service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.generate_certificate_code() to service_role;
grant execute on function public._try_issue_certificate(uuid, uuid, uuid) to service_role;
grant execute on function public._completion_status(uuid, uuid) to service_role;
grant execute on function public._notify(uuid, text, jsonb, text) to service_role;
grant execute on function public._audit(text, text, text, jsonb) to service_role;
grant execute on function public.set_updated_at() to service_role;
