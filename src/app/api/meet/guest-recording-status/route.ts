import { NextResponse } from "next/server";
import { handleGuestMeetingRecordingStatus } from "@/lib/calendar/meeting-recording-guest-status";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteToken =
    typeof body === "object" &&
    body &&
    "inviteToken" in body &&
    typeof (body as { inviteToken: unknown }).inviteToken === "string"
      ? (body as { inviteToken: string }).inviteToken
      : "";

  const result = await handleGuestMeetingRecordingStatus(inviteToken);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
