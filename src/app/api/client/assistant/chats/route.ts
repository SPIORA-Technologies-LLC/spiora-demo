import { NextResponse } from "next/server";
import {
  MAX_PORTAL_CHATS,
  UNTITLED_PORTAL_CHAT,
  createPortalChat,
  listPortalChats,
} from "@/lib/ai/client-portal-chats";
import { getClientSession } from "@/lib/client-portal/session";

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chats = await listPortalChats(session.id);
  return NextResponse.json({ chats, limit: MAX_PORTAL_CHATS });
}

export async function POST() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chat = await createPortalChat(session.id, UNTITLED_PORTAL_CHAT);
  return NextResponse.json({ chat });
}
