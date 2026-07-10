import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { notifyTeamChatMessage } from "@/lib/notifications/emit";
import { enforceTeamChatDemoGuard } from "@/lib/team-chat/demo-api-guard";
import {
  createTeamChatMessage,
  listTeamChatMessages,
} from "@/lib/team-chat/store";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "100");
  const beforeCreatedAt = searchParams.get("before") ?? undefined;
  const afterCreatedAt = searchParams.get("after") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const locale = await getRequestLocale();

  const result = await listTeamChatMessages({
    limit,
    beforeCreatedAt,
    afterCreatedAt,
    q,
    locale,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { text?: string; replyToId?: string };
  if (!body?.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const blocked = await enforceTeamChatDemoGuard(
    session.id,
    "send",
    body.text.length,
  );
  if (blocked) {
    return blocked;
  }

  const locale = await getRequestLocale();

  try {
    const message = await createTeamChatMessage(
      {
        text: body.text,
        replyToId:
          typeof body.replyToId === "string" ? body.replyToId : undefined,
      },
      session,
      locale,
    );
    await notifyTeamChatMessage({
      senderId: session.id,
      senderName: session.name,
      text: message.message_text,
    });
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
}
