import { NextResponse } from "next/server";
import {
  runPortalAssistant,
  runPortalAssistantStream,
} from "@/lib/ai/client-portal-assistant";
import type { PortalChatTurn } from "@/lib/ai/client-portal-chat-types";
import { getWorkspaceAiConfig } from "@/lib/ai/workspace-config";
import { checkDemoRateLimit } from "@/lib/ai/workspace-demo-rate-limit";
import { getClientSession } from "@/lib/client-portal/session";
import { getRequestLocale } from "@/i18n/api-messages";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const body = (await request.json()) as {
    message?: string;
    history?: PortalChatTurn[];
  };

  const message = body.message ?? "";
  const history = Array.isArray(body.history) ? body.history : [];

  const rateLimit = checkDemoRateLimit(`portal:${session.id}`, locale, {
    promptLength: message.length,
    historyTurns: history.length,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({
      reply: rateLimit.message,
      sources: [],
      demo: true,
    });
  }

  const { stream } = getWorkspaceAiConfig();

  if (stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of runPortalAssistantStream(
            message,
            history,
            locale,
          )) {
            if (typeof chunk === "string") {
              controller.enqueue(
                encoder.encode(
                  `event: delta\ndata: ${JSON.stringify({ content: chunk })}\n\n`,
                ),
              );
              continue;
            }

            controller.enqueue(
              encoder.encode(
                `event: meta\ndata: ${JSON.stringify({
                  sources: chunk.sources,
                  demo: chunk.demo,
                })}\n\n`,
              ),
            );
          }
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        } catch (error) {
          console.error("[portal-ai] stream failed", error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message:
                  locale === "ru"
                    ? "Не удалось получить ответ ассистента."
                    : "Could not get an assistant reply.",
              })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await runPortalAssistant(message, history, locale);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[portal-ai] request failed", error);
    return NextResponse.json(
      {
        reply:
          locale === "ru"
            ? "Не удалось получить ответ ассистента."
            : "Could not get an assistant reply.",
        sources: [],
        demo: true,
      },
      { status: 500 },
    );
  }
}
