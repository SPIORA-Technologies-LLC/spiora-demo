import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { notifyTeamChatMessage } from "@/lib/notifications/emit";
import { enforceTeamChatDemoGuard } from "@/lib/team-chat/demo-api-guard";
import { normalizeTeamChatAudioContentType } from "@/lib/team-chat/audio-storage";
import { createVoiceTeamChatMessage } from "@/lib/team-chat/store";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await enforceTeamChatDemoGuard(session.id, "upload");
  if (blocked) {
    return blocked;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioEntry = formData.get("audio");
  const durationRaw = formData.get("duration_ms");

  if (!(audioEntry instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const durationMs = Number(durationRaw);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const replyToId = String(formData.get("replyToId") ?? "").trim() || undefined;
  const locale = await getRequestLocale();

  const contentType = normalizeTeamChatAudioContentType(
    audioEntry.type || "audio/webm",
  );
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  const buffer = Buffer.from(await audioEntry.arrayBuffer());

  try {
    const message = await createVoiceTeamChatMessage(
      { durationMs, replyToId },
      session,
      buffer,
      contentType,
      locale,
    );

    await notifyTeamChatMessage({
      senderId: session.id,
      senderName: session.name,
      text: "",
      isVoice: true,
    });

    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save voice message";
    const status = message.includes("large") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
