#!/usr/bin/env node
/**
 * Grant (or revoke) administrator rights for an existing, registered account.
 * There are no hard-coded admin credentials: register normally, confirm your email, then run
 *
 *   node scripts/promote-admin.mjs you@example.com          # make admin
 *   node scripts/promote-admin.mjs you@example.com --revoke # back to student
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or .env.local.
 * Run it only on a trusted machine; the service role key bypasses Row Level Security.
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const [email, flag] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Usage: node scripts/promote-admin.mjs <email> [--revoke]");
  process.exit(1);
}
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const role = flag === "--revoke" ? "student" : "admin";
const { data: profile, error } = await db.from("profiles").select("id, email, role, status").ilike("email", email).maybeSingle();
if (error) {
  console.error("Lookup failed:", error.message);
  process.exit(1);
}
if (!profile) {
  console.error(`No account found for ${email}. Register on the website first and confirm the email address.`);
  process.exit(1);
}
const { error: upErr } = await db.from("profiles").update({ role }).eq("id", profile.id);
if (upErr) {
  console.error("Update failed:", upErr.message);
  process.exit(1);
}
await db.from("audit_logs").insert({ actor_id: null, action: `user.role_${role}`, entity_type: "profile", entity_id: profile.id, details: { via: "promote-admin script" } });
console.log(`${profile.email} is now ${role}.`);
