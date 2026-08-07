import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Legacy admin password-generation endpoint (pre-D1).
 * Disabled: use POST .../send-password-reset (no plaintext password).
 */
export async function POST(_request: Request, _params: Params) {
  return NextResponse.json(
    {
      error: {
        code: "GONE",
        message:
          "Use POST /api/client-invitations/[id]/send-password-reset",
      },
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
