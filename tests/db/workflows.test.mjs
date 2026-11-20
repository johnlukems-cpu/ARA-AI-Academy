/**
 * End-to-end database tests for the acceptance workflows A–J, run against a real PostgreSQL
 * server with a minimal Supabase stub (auth.uid() from request.jwt.claims, roles, storage schema).
 *
 *   PGHOST=localhost PGUSER=postgres npm run test:db
 *
 * The suite (re)creates the database `ara_test`, applies supabase/tests/supabase_stub.sql,
 * all migrations and the seed, then exercises every workflow through the same RPCs and RLS
 * policies the application uses. Quiz grading itself runs in TypeScript (unit tested); here
 * graded attempts are written with the service role, exactly as the server does.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DB = process.env.TEST_DB || "ara_test";
let su; // superuser connection to the test database

async function sql(text, params = []) {
  return (await su.query(text, params)).rows;
}

/** Run one statement as a given role/user, with RLS and auth.uid() active. */
async function as(who, text, params = []) {
  const claims = who === "anon" ? { role: "anon" } : who === "service" ? { role: "service_role" } : { sub: who, role: "authenticated" };
  const role = who === "anon" ? "anon" : who === "service" ? "service_role" : "authenticated";
  await su.query("begin");
  try {
    await su.query(`set local role ${role}`);
    await su.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const res = await su.query(text, params);
    await su.query("commit");
    return res.rows;
  } catch (e) {
    await su.query("rollback");
    throw e;
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (e) => {
    assert.match(String(e.message), pattern);
    return true;
  });
}

const ids = {};

before(async () => {
  const admin = new pg.Client({ database: "postgres" });
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.query(`create database ${DB}`);
  await admin.end();
  su = new pg.Client({ database: DB });
  await su.connect();
  await su.query(readFileSync(join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
  const migDir = join(root, "supabase/migrations");
  for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    await su.query(readFileSync(join(migDir, f), "utf8"));
  }
  await su.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  // The seed is idempotent: a second run must not duplicate anything.
  await su.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
});

after(async () => {
  await su?.end();
});

test("seed: 8 draft courses, bilingual, no duplicates", async () => {
  const courses = await sql("select slug, status from public.courses order by sort_order");
  assert.equal(courses.length, 8);
  assert.ok(courses.every((c) => c.status === "draft"), "seeded courses must be drafts");
  const [{ n }] = await sql("select count(*)::int n from public.course_translations");
  assert.equal(n, 16);
  const [{ missing }] = await sql("select count(*)::int missing from public.lessons where coalesce(title->>'nl','') = '' or coalesce(title->>'en','') = ''");
  assert.equal(missing, 0);
  const [{ methods }] = await sql("select count(*)::int methods from public.payment_methods");
  assert.equal(methods, 3);
});

test("A – registration creates a student profile without any course access", async () => {
  const mk = async (email, meta) => (await sql("insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1, $2, now()) returning id", [email, meta]))[0].id;
  ids.student = await mk("student@example.sr", { first_name: "Anaïs", last_name: "Ramdin", phone: "+5978000000", country: "SR", preferred_locale: "en", terms_accepted: "true" });
  ids.other = await mk("other@example.sr", { first_name: "Bas", last_name: "Kromo", preferred_locale: "nl" });
  ids.admin = await mk("admin@example.sr", { first_name: "Ara", last_name: "Admin" });
  const [p] = await sql("select role, status, preferred_locale, terms_accepted_at from public.profiles where id = $1", [ids.student]);
  assert.equal(p.role, "student");
  assert.equal(p.status, "active");
  assert.equal(p.preferred_locale, "en");
  assert.ok(p.terms_accepted_at);
  const [{ n }] = await sql("select count(*)::int n from public.enrollments where student_id = $1", [ids.student]);
  assert.equal(n, 0, "registration must not enroll");
  // A student cannot promote themselves.
  await as(ids.student, "update public.profiles set role = 'admin' where id = $1", [ids.student]).catch(() => {});
  assert.equal((await sql("select role from public.profiles where id = $1", [ids.student]))[0].role, "student");
  // Anonymous visitors cannot read profiles; students only see their own.
  assert.equal((await as("anon", "select id from public.profiles")).length, 0);
  assert.equal((await as(ids.student, "select id from public.profiles")).length, 1);
  // Administrator access is granted out-of-band (scripts/promote-admin.mjs), never via the app.
  await sql("update public.profiles set role = 'admin' where id = $1", [ids.admin]);
});

test("I – admin prepares and publishes a course (students cannot)", async () => {
  ids.course = (await sql("select id from public.courses where slug = 'ai-fundamentals'"))[0].id;
  await as(ids.student, "update public.courses set status = 'published' where id = $1", [ids.course]).catch(() => {});
  assert.equal((await sql("select status from public.courses where id = $1", [ids.course]))[0].status, "draft");

  await as(ids.admin, "update public.courses set price = 2500, require_final_exam = true where id = $1", [ids.course]);
  await as(ids.admin, "update public.lessons set status = 'published' where course_id = $1", [ids.course]);
  await as(ids.admin, "update public.quizzes set status = 'published' where course_id = $1", [ids.course]);
  // Lesson quizzes need at least one question each.
  const lessonQuizzes = await as(ids.admin, "select id from public.quizzes where course_id = $1 and kind = 'quiz'", [ids.course]);
  for (const q of lessonQuizzes) {
    const [qq] = await as(ids.admin, "insert into public.quiz_questions (quiz_id, type, prompt, points) values ($1, 'true_false', '{\"nl\":\"AI kan leren van data.\",\"en\":\"AI can learn from data.\"}', 1) returning id", [q.id]);
    await as(ids.admin, "insert into public.quiz_options (question_id, label, is_correct, position) values ($1, '{\"nl\":\"Waar\",\"en\":\"True\"}', true, 1), ($1, '{\"nl\":\"Onwaar\",\"en\":\"False\"}', false, 2)", [qq.id]);
  }
  await as(ids.admin, "update public.courses set status = 'published', published_at = now() where id = $1", [ids.course]);
  const [c] = await sql("select status, price, access_days from public.courses where id = $1", [ids.course]);
  assert.equal(c.status, "published");
  assert.equal(Number(c.price), 2500);
  assert.equal(c.access_days, 90);
  // The exam must have questions (seeded: 6).
  const [{ n }] = await sql("select count(*)::int n from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id where z.course_id = $1 and z.kind = 'final_exam'", [ids.course]);
  assert.equal(n, 6);
});

test("B – enrollment request and payment submission (no access yet)", async () => {
  const [enr] = await as(ids.student, "select * from public.request_enrollment($1)", [ids.course]);
  ids.enrollment = enr.id;
  assert.equal(enr.status, "pending");
  assert.equal((await as(ids.student, "select * from public.request_enrollment($1)", [ids.course]))[0].id, enr.id, "idempotent");
  assert.equal((await as(ids.student, "select public.has_course_access($1) ok", [ids.course]))[0].ok, false);
  assert.equal((await as(ids.student, "select lesson_id from public.lesson_contents where course_id = $1", [ids.course])).length, 0, "no content before approval");

  const [bank] = await sql("select id from public.payment_methods where code = 'bank_transfer'");
  ids.bank = bank.id;
  await rejects(as(ids.student, "select * from public.submit_payment($1, $2, current_date, '', null, '[]')", [enr.id, bank.id]), /reference_required|proof_required/);
  await rejects(
    as(ids.student, "select * from public.submit_payment($1, $2, current_date, 'TRX-1', null, $3)", [enr.id, bank.id, JSON.stringify([{ storage_path: `${ids.other}/x.pdf`, file_name: "x.pdf", mime_type: "application/pdf", file_size: 10 }])]),
    /./,
  );
  const [pay] = await as(ids.student, "select * from public.submit_payment($1, $2, current_date, 'TRX-1', 'Betaald via DSB', $3)", [
    enr.id, bank.id, JSON.stringify([{ storage_path: `${ids.student}/proof.pdf`, file_name: "proof.pdf", mime_type: "application/pdf", file_size: 1234 }]),
  ]);
  ids.payment = pay.id;
  assert.equal(pay.status, "pending");
  assert.equal(Number(pay.amount), 2500, "amount comes from the course price, not the client");
  assert.equal(pay.currency, "SRD");
  await rejects(as(ids.student, "select * from public.submit_payment($1, $2, current_date, 'TRX-2', null, $3)", [enr.id, bank.id, JSON.stringify([{ storage_path: `${ids.student}/p2.pdf`, file_name: "p2.pdf", mime_type: "application/pdf", file_size: 1 }])]), /payment_already_pending/);

  // Privacy: other students and anonymous users cannot see the payment or its evidence.
  assert.equal((await as(ids.other, "select id from public.payments")).length, 0);
  assert.equal((await as(ids.other, "select id from public.payment_evidence")).length, 0);
  assert.equal((await as("anon", "select id from public.payments")).length, 0);
  // The student cannot approve their own payment.
  await rejects(as(ids.student, "update public.payments set status = 'approved' where id = $1", [pay.id]), /permission denied/);
  await rejects(as(ids.student, "select * from public.admin_approve_payment($1)", [pay.id]), /not_authorized|42501/);
});

test("C + D – admin approval activates 90 days of access", async () => {
  const [enr] = await as(ids.admin, "select * from public.admin_approve_payment($1, 'OK')", [ids.payment]);
  assert.equal(enr.status, "active");
  const days = (new Date(enr.expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 89.9 && days <= 90, `expected ~90 days, got ${days}`);
  assert.equal((await sql("select status, reviewed_by from public.payments where id = $1", [ids.payment]))[0].reviewed_by, ids.admin);
  assert.equal((await as(ids.student, "select public.has_course_access($1) ok", [ids.course]))[0].ok, true);
  assert.ok((await as(ids.student, "select lesson_id from public.lesson_contents where course_id = $1", [ids.course])).length > 0);
  await rejects(as(ids.admin, "select * from public.admin_approve_payment($1)", [ids.payment]), /payment_not_pending/);
  const audit = await sql("select action from public.audit_logs where entity_id = $1", [ids.payment]);
  assert.ok(audit.some((a) => a.action === "payment.approved"));
  // Another student still has no access.
  assert.equal((await as(ids.other, "select public.has_course_access($1) ok", [ids.course]))[0].ok, false);
});

test("E – learning: completion requires accessing content; quizzes, PDFs and assignments enforced", async () => {
  const lessons = await as(ids.student, "select id, type from public.lessons where course_id = $1 order by position", [ids.course]);
  const first = lessons.find((l) => l.type === "text" || l.type === "video");
  await rejects(as(ids.student, "select public.complete_lesson($1)", [first.id]), /content_not_accessed/);

  // PDF lesson with a resource must have the resource opened.
  const pdf = lessons.find((l) => l.type === "pdf");
  if (pdf) {
    await as(ids.admin, "insert into public.lesson_resources (lesson_id, course_id, title, kind, storage_path) values ($1, $2, '{\"nl\":\"Hand-out\",\"en\":\"Handout\"}', 'file', 'resources/x.pdf')", [pdf.id, ids.course]);
    await as(ids.student, "select public.record_lesson_access($1, false)", [pdf.id]);
    await rejects(as(ids.student, "select public.complete_lesson($1)", [pdf.id]), /resource_not_opened/);
  }

  for (const l of lessons) {
    await as(ids.student, "select public.record_lesson_access($1, $2)", [l.id, l.type === "pdf"]);
    if (l.type === "quiz") {
      await rejects(as(ids.student, "select public.complete_lesson($1)", [l.id]), /quiz_not_passed/);
      const [quiz] = await sql("select id from public.quizzes where lesson_id = $1", [l.id]);
      const qids = (await sql("select id from public.quiz_questions where quiz_id = $1", [quiz.id])).map((r) => r.id);
      await as("service", "insert into public.quiz_attempts (quiz_id, student_id, course_id, question_ids, status, score, max_score, percentage, passed, submitted_at) values ($1, $2, $3, $4, 'submitted', 1, 1, 100, true, now())", [quiz.id, ids.student, ids.course, qids]);
    }
    if (l.type === "assignment") {
      await rejects(as(ids.student, "select public.complete_lesson($1)", [l.id]), /assignment_not_submitted/);
      const [asg] = await as(ids.student, "select id from public.assignments where lesson_id = $1", [l.id]);
      await rejects(as(ids.student, "select public.submit_assignment($1, null, null, null, null)", [asg.id]), /submission_empty/);
      const sub = (await as(ids.student, "select * from public.submit_assignment($1, 'Mijn uitwerking van de praktijkopdracht.', null, null, null)", [asg.id]))[0];
      ids.submission = sub.id;
      ids.assignment = asg.id;
      assert.equal(sub.status, "submitted");
      continue; // submitting completes the lesson
    }
    await as(ids.student, "select public.complete_lesson($1)", [l.id]);
  }
  const [p] = await as(ids.student, "select * from public.course_progress($1, $2)", [ids.student, ids.course]);
  assert.equal(p.percentage, 100);
  assert.equal(p.completed_lessons, lessons.length);
  // Students cannot read another student's progress.
  await rejects(as(ids.other, "select * from public.course_progress($1, $2)", [ids.student, ids.course]), /not_authorized|42501/);
  assert.equal((await as(ids.other, "select * from public.lesson_progress")).length, 0);
});

test("F – examination: answer keys hidden, attempts server-written, failing does not certify", async () => {
  const [exam] = await sql("select id from public.quizzes where course_id = $1 and kind = 'final_exam'", [ids.course]);
  ids.exam = exam.id;
  assert.equal((await as(ids.student, "select id from public.quiz_questions where quiz_id = $1", [exam.id])).length, 0, "questions are admin-only");
  assert.equal((await as(ids.student, "select id, is_correct from public.quiz_options")).length, 0, "answer key is admin-only");
  await rejects(as(ids.student, "insert into public.quiz_attempts (quiz_id, student_id, course_id, question_ids, status, passed) values ($1, $2, $3, '{}', 'submitted', true)", [exam.id, ids.student, ids.course]), /row-level security|permission denied/);

  const qids = (await sql("select id from public.quiz_questions where quiz_id = $1", [exam.id])).map((r) => r.id);
  await as("service", "insert into public.quiz_attempts (quiz_id, student_id, course_id, question_ids, attempt_number, status, score, max_score, percentage, passed, submitted_at) values ($1, $2, $3, $4, 1, 'submitted', 3, 6, 50, false, now())", [exam.id, ids.student, ids.course, qids]);
  const st = (await as(ids.student, "select public.completion_status($1, $2) s", [ids.student, ids.course]))[0].s;
  assert.equal(st.exam_passed, false);
  assert.equal(Number(st.exam_best), 50);
  assert.equal(st.eligible, false);
  // The student sees their own attempt results but not other students' attempts.
  assert.equal((await as(ids.student, "select id from public.quiz_attempts where quiz_id = $1", [exam.id])).length, 1);
  assert.equal((await as(ids.other, "select id from public.quiz_attempts")).length, 0);
});

test("G – certification after all requirements, with public verification", async () => {
  await as("service", "insert into public.quiz_attempts (quiz_id, student_id, course_id, question_ids, attempt_number, status, score, max_score, percentage, passed, submitted_at) select $1, $2, $3, question_ids, 2, 'submitted', 5, 6, 83.33, true, now() from public.quiz_attempts where quiz_id = $1 and student_id = $2 limit 1", [ids.exam, ids.student, ids.course]);
  // Assignment still awaits review → not eligible yet.
  assert.equal((await as("service", "select public.try_issue_certificate($1, $2) id", [ids.student, ids.course]))[0].id, null);
  await rejects(as(ids.student, "select * from public.admin_review_submission($1, 'approved', 90, 'Goed')", [ids.submission]), /not_authorized|42501/);
  await as(ids.admin, "select * from public.admin_review_submission($1, 'approved', 90, 'Sterk uitgewerkt.')", [ids.submission]);

  const [cert] = await sql("select * from public.certificates where student_id = $1 and course_id = $2 and status = 'valid'", [ids.student, ids.course]);
  assert.ok(cert, "certificate issued automatically on the last requirement");
  assert.match(cert.code, /^ARA-\d{4}-[2-9A-HJ-NP-Z]{8}$/);
  assert.equal(cert.recipient_name, "Anaïs Ramdin");
  assert.equal(cert.locale, "en");
  assert.ok(cert.course_title.nl && cert.course_title.en, "title stored in both languages");
  assert.equal(Number(cert.final_score), 83.33);
  ids.cert = cert.id;
  ids.code = cert.code;
  assert.ok((await sql("select completed_at from public.enrollments where id = $1", [ids.enrollment]))[0].completed_at);

  const [v] = await as("anon", "select * from public.verify_certificate($1)", [ids.code.toLowerCase()]);
  assert.equal(v.status, "valid");
  assert.equal(v.recipient_name, "Anaïs Ramdin");
  assert.equal((await as("anon", "select * from public.verify_certificate('ARA-2026-XXXXXXXX')")).length, 0);
  assert.equal((await as("anon", "select id from public.certificates")).length, 0, "no direct table access");
  assert.equal((await as(ids.other, "select id from public.certificates")).length, 0);
  assert.equal((await as(ids.student, "select id from public.certificates")).length, 1);
  // Idempotent: no second certificate.
  assert.equal((await as("service", "select public.try_issue_certificate($1, $2) id", [ids.student, ids.course]))[0].id, ids.cert);
});

test("H – expiry removes access but keeps progress and certificates; admin can extend", async () => {
  await sql("update public.enrollments set expires_at = now() - interval '1 minute' where id = $1", [ids.enrollment]);
  assert.equal((await as(ids.student, "select public.has_course_access($1) ok", [ids.course]))[0].ok, false, "access ends at expires_at even before the job runs");
  await rejects(as(ids.student, "select * from public.expire_enrollments()"), /not_authorized|42501/);
  const expired = await as("service", "select id from public.expire_enrollments()");
  assert.ok(expired.some((e) => e.id === ids.enrollment));
  assert.equal((await sql("select status from public.enrollments where id = $1", [ids.enrollment]))[0].status, "expired");
  assert.equal((await as(ids.student, "select lesson_id from public.lesson_contents where course_id = $1", [ids.course])).length, 0);
  const [p] = await as(ids.student, "select * from public.course_progress($1, $2)", [ids.student, ids.course]);
  assert.equal(p.percentage, 100, "progress preserved");
  assert.equal((await as(ids.student, "select id from public.certificates")).length, 1, "certificate preserved");
  assert.ok((await sql("select 1 from public.notifications where user_id = $1 and type = 'access_expired'", [ids.student])).length);

  const [ext] = await as(ids.admin, "select * from public.admin_extend_enrollment($1, 30, 'Coulance')", [ids.enrollment]);
  assert.equal(ext.status, "active");
  const days = (new Date(ext.expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30, `extension from today: ${days}`);
  assert.equal((await as(ids.student, "select public.has_course_access($1) ok", [ids.course]))[0].ok, true);
});

test("I – administration: dashboard, rejection, refund, manual enrollment, suspension, revocation", async () => {
  const stats = (await as(ids.admin, "select public.admin_dashboard_stats() s"))[0].s;
  assert.equal(Number(stats.revenue.SRD), 2500);
  assert.ok(stats.total_students >= 2);
  await rejects(as(ids.student, "select public.admin_dashboard_stats()"), /not_authorized|42501/);

  // Second student: rejected, resubmitted, approved, refunded with revocation.
  const [enr] = await as(ids.other, "select * from public.request_enrollment($1)", [ids.course]);
  const ev = JSON.stringify([{ storage_path: `${ids.other}/a.jpg`, file_name: "a.jpg", mime_type: "image/jpeg", file_size: 99 }]);
  const [p1] = await as(ids.other, "select * from public.submit_payment($1, $2, current_date, 'R-1', null, $3)", [enr.id, ids.bank, ev]);
  await rejects(as(ids.admin, "select * from public.admin_reject_payment($1, '')", [p1.id]), /reason_required/);
  await as(ids.admin, "select * from public.admin_reject_payment($1, 'Bedrag onjuist')", [p1.id]);
  assert.equal((await sql("select status from public.enrollments where id = $1", [enr.id]))[0].status, "pending");
  const [p2] = await as(ids.other, "select * from public.submit_payment($1, $2, current_date, 'R-2', null, $3)", [enr.id, ids.bank, ev]);
  await as(ids.admin, "select * from public.admin_approve_payment($1)", [p2.id]);
  await as(ids.admin, "select * from public.admin_refund_payment($1, true, 'Terugbetaald')", [p2.id]);
  assert.equal((await sql("select status from public.payments where id = $1", [p2.id]))[0].status, "refunded");
  assert.equal((await as(ids.other, "select public.has_course_access($1) ok", [ids.course]))[0].ok, false);

  // Manual enrollment by admin with a recorded payment.
  const [man] = await as(ids.admin, "select * from public.admin_manual_enroll($1, $2, 60, 2500, $3, 'KAS-7', 'Contant betaald')", [ids.other, ids.course, ids.bank]);
  assert.equal(man.status, "active");
  assert.equal((await as(ids.other, "select public.has_course_access($1) ok", [ids.course]))[0].ok, true);

  // Suspension blocks access and new requests.
  await rejects(as(ids.admin, "select public.admin_set_user_status($1, 'suspended', null)", [ids.admin]), /cannot_change_self/);
  await as(ids.admin, "select public.admin_set_user_status($1, 'suspended', 'Misbruik')", [ids.other]);
  assert.equal((await as(ids.other, "select public.has_course_access($1) ok", [ids.course]))[0].ok, false);
  await as(ids.admin, "select public.admin_set_user_status($1, 'active', null)", [ids.other]);

  // Certificate revocation shows on the public verification page; reissue creates a new code.
  await as(ids.admin, "select * from public.admin_revoke_certificate($1, 'Fraude onderzocht')", [ids.cert]);
  assert.equal((await as("anon", "select status from public.verify_certificate($1)", [ids.code]))[0].status, "revoked");
  const [re] = await as(ids.admin, "select * from public.admin_reissue_certificate($1)", [ids.cert]);
  assert.notEqual(re.code, ids.code);
  assert.equal((await as("anon", "select status from public.verify_certificate($1)", [re.code]))[0].status, "valid");

  const actions = (await sql("select distinct action from public.audit_logs")).map((r) => r.action);
  for (const a of ["payment.approved", "payment.rejected", "payment.refunded", "enrollment.extended", "certificate.revoked"]) {
    assert.ok(actions.includes(a), `audit log contains ${a} (has: ${actions.join(", ")})`);
  }
});

test("J – bilingual data model and storage isolation", async () => {
  const [{ n }] = await sql("select count(*)::int n from public.course_modules where coalesce(title->>'nl','') = '' or coalesce(title->>'en','') = ''");
  assert.equal(n, 0);
  const methods = await as("anon", "select name from public.payment_methods where is_active");
  assert.ok(methods.every((m) => m.name.nl && m.name.en));
  // Anonymous visitors can read published course outlines but never lesson content.
  assert.ok((await as("anon", "select id from public.lessons where course_id = $1", [ids.course])).length > 0);
  assert.equal((await as("anon", "select lesson_id from public.lesson_contents where course_id = $1", [ids.course])).length, 0);
  // Draft courses are invisible to the public.
  assert.equal((await as("anon", "select id from public.courses where status = 'draft'")).length, 0);
  // Admin notification email is not exposed through public settings.
  await rejects(as("anon", "select admin_notification_email from public.academy_settings"), /permission denied/);
});
