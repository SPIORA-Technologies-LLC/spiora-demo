import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolvePresenceUserId } from "@/lib/presence/resolve-user-id";
import { touchUserPresence } from "@/lib/presence/store";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const presenceUserId = await resolvePresenceUserId(session);
  const lastActiveAt = await touchUserPresence(presenceUserId);
  return NextResponse.json({ ok: true, lastActiveAt });
}
