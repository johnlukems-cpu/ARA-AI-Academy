import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/i18n/config";

async function handle(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const l = request.nextUrl.searchParams.get("locale");
  const locale = isLocale(l) ? l : "nl";
  const reason = request.nextUrl.searchParams.get("reason");
  const target = reason === "suspended" ? `/${locale}/login?error=suspended` : `/${locale}`;
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), { status: 303 });
}

export const GET = handle;
export const POST = handle;
