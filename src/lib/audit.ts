import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  try {
    await createAdminClient().from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip: await clientIp(),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
