import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";
import { emailStudent } from "@/lib/notify";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** Handles email verification, password recovery and magic links (token_hash or PKCE code). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "nl";
  const next = safeNext(searchParams.get("next"), `/${locale}/dashboard`);

  const supabase = await createClient();
  let ok = false;
  let userId: string | undefined;
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    userId = data.user?.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    userId = data.user?.id;
  }

  if (!ok) return NextResponse.redirect(new URL(`/${locale}/login?error=link`, origin));

  if (type === "recovery") return NextResponse.redirect(new URL(`/${locale}/reset-password`, origin));

  if (userId && (type === "signup" || type === "email" || (!type && code))) {
    await emailStudent(userId, "welcome");
    const url = new URL(next, origin);
    url.searchParams.set("verified", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(next, origin));
}
