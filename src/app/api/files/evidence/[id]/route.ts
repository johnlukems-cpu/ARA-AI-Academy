import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/storage";

/** Payment proof: admins, or the student who uploaded it (RLS decides visibility). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/evidence/[id]">) {
  const { id } = await ctx.params;
  const current = await getCurrentUser();
  if (!current || current.profile.status !== "active") return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("payment_evidence").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  const url = await signedDownloadUrl("payment-proofs", data.storage_path, 120);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
