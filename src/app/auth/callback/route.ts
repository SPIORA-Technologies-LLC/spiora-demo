import { NextResponse } from "next/server";
import { getCanonicalAppOrigin } from "@/lib/auth/canonical-app-origin";

export const dynamic = "force-dynamic";

/**
 * Deprecated OAuth callback.
 * Never exchanges codes or creates sessions — use /auth/callback/employee|client.
 */
export async function GET(request: Request) {
  void request;
  const origin = getCanonicalAppOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(
    new URL("/login?error=unsupported_callback", origin),
  );
}
