import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/storage";

/** Assignment file: admins or the submitting student (RLS decides visibility). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/submission/[id]">) {
  const { id } = await ctx.params;
  const current = await getCurrentUser();
  if (!current || current.profile.status !== "active") return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("assignment_submissions").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data?.storage_path) return new NextResponse("Not found", { status: 404 });
  const url = await signedDownloadUrl("assignment-files", data.storage_path, 120, data.file_name ?? undefined);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
