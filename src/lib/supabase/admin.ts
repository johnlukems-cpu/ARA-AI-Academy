import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. BYPASSES RLS – only use on the server after an explicit
 * authorization check (requireUser / requireAdmin) or for system jobs.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("Supabase service role is not configured (SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (!cached) {
    cached = createClient(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
