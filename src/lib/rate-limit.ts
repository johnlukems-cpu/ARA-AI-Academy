import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

/**
 * Fixed-window rate limit backed by Postgres (works on serverless without Redis).
 * Fails open if the database is unreachable so legitimate users are never locked out by an outage.
 */
export async function rateLimit(action: string, max: number, windowSeconds: number, identifier?: string): Promise<boolean> {
  try {
    const key = `${action}:${identifier ?? (await clientIp())}`;
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
