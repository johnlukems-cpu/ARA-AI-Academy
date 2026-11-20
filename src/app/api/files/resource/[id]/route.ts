import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/storage";

/**
 * Lesson resource download. RLS on lesson_resources only returns rows to students with
 * active, non-expired access (or admins). Opening a resource is recorded as progress.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/resource/[id]">) {
  const { id } = await ctx.params;
  const current = await getCurrentUser();
  if (!current || current.profile.status !== "active") return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_resources").select("lesson_id, kind, storage_path, url, title").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  if (current.profile.role !== "admin") {
    await supabase.rpc("record_lesson_access", { p_lesson_id: data.lesson_id, p_resource: true });
  }
  if (data.kind === "link" && data.url) return NextResponse.redirect(data.url);
  if (!data.storage_path) return new NextResponse("Not found", { status: 404 });
  const url = await signedDownloadUrl("course-resources", data.storage_path, 300);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
