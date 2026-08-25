import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirects";

/**
 * Where Supabase sends a student after they click the confirmation link
 * (FR-A2), and later the password-reset link (Sprint 12).
 *
 * A Route Handler rather than a page, because the only job here is to trade the
 * one-time code for a session, write the cookies, and redirect. Nothing is
 * rendered, so there is nothing to flash.
 *
 * `next` is validated before it is used. An open redirect is the classic bug in
 * exactly this handler: `?next=https://evil.example` would otherwise send a
 * student who just proved they own their inbox straight to an attacker's page,
 * carrying the trust of a link that genuinely came from us. Only same-origin
 * paths are honoured.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  // Supabase reports a rejected link in the query string rather than by status.
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) {
    const reason = errorCode.includes("expired") ? "expired" : "invalid";
    return NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // A link that has already been used lands here too — the code is single-use.
    const reason = error.code === "flow_state_expired" ? "expired" : "used";
    return NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
