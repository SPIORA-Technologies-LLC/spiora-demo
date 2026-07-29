import { NextResponse } from "next/server";
import type { PortalChatTurn } from "@/lib/ai/client-portal-chat-types";
import {
  deletePortalChat,
  getPortalChat,
  updatePortalChat,
} from "@/lib/ai/client-portal-chats";
import { getClientSession } from "@/lib/client-portal/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const chat = await getPortalChat(session.id, id);
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ chat });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { messages?: PortalChatTurn[] };

  if (!body.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const chat = await updatePortalChat(session.id, id, body.messages);
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ chat });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const ok = await deletePortalChat(session.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
