import "server-only";

import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateTeamChatMessage } from "@/i18n/team-chat-messages";
import {
  checkTeamChatDemoActionRateLimit,
  type TeamChatDemoAction,
} from "./demo-rate-limit";

export async function enforceTeamChatDemoGuard(
  userId: string,
  action: TeamChatDemoAction,
  textLength = 0,
): Promise<NextResponse | null> {
  const result = checkTeamChatDemoActionRateLimit(userId, action, textLength);
  if (result.allowed) {
    return null;
  }

  const locale = await getRequestLocale();
  const key =
    result.reason === "minute"
      ? action === "upload"
        ? "limits.uploadPerMinute"
        : action === "delete"
          ? "limits.deletePerMinute"
          : "limits.ratePerMinute"
      : result.reason === "total"
        ? "limits.ratePerUser"
        : "errors.messageTooLong";

  const status = result.reason === "length" ? 400 : 429;
  return NextResponse.json(
    { error: translateTeamChatMessage(locale, key) },
    { status },
  );
}
