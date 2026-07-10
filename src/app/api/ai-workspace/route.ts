import { NextResponse } from "next/server";
import {
  runWorkspaceAi,
  runWorkspaceAiStream,
  type WorkspaceChatTurn,
} from "@/lib/ai/workspace-assistant";
import type { ClientContext } from "@/lib/ai/client-context";
import {
  sanitizeClientContextsForTransport,
} from "@/lib/ai/context-redaction";
import {
  getWorkspaceAiConfig,
  isWorkspaceResponseMode,
} from "@/lib/ai/workspace-config";
import { checkDemoRateLimit } from "@/lib/ai/workspace-demo-rate-limit";
import {
  isWorkspaceDiagnosticsEnabled,
  stripClientContextsForDemoPublic,
} from "@/lib/ai/workspace-demo-safe";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateWorkspaceMessage } from "@/i18n/ai-workspace-messages";

function parseMode(value: unknown) {
  if (typeof value === "string" && isWorkspaceResponseMode(value)) {
    return value;
  }
  return "brief" as const;
}

function finalizeWorkspacePayload<T extends {
  pendingClientCandidates?: ClientContext[];
}>(payload: T): T {
  if (isWorkspaceDiagnosticsEnabled()) {
    return {
      ...payload,
      pendingClientCandidates: sanitizeClientContextsForTransport(
        payload.pendingClientCandidates,
      ),
    };
  }

  return {
    ...payload,
    pendingClientCandidates: stripClientContextsForDemoPublic(
      sanitizeClientContextsForTransport(payload.pendingClientCandidates),
    ),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const body = (await request.json()) as {
    message?: string;
    history?: WorkspaceChatTurn[];
    mode?: string;
    pendingClientCandidates?: ClientContext[];
  };

  const mode = parseMode(body.mode);
  const message = body.message ?? "";
  const history = body.history ?? [];
  const pendingClientCandidates =
    sanitizeClientContextsForTransport(body.pendingClientCandidates) ?? null;

  const rateLimit = checkDemoRateLimit(session.id, locale, {
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
  const internalError = translateWorkspaceMessage(locale, "errors.internal");

  if (stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of runWorkspaceAiStream(
            message,
            history,
            mode,
            pendingClientCandidates,
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

            if ("status" in chunk) {
              controller.enqueue(
                encoder.encode(
                  `event: status\ndata: ${JSON.stringify({ phase: chunk.status })}\n\n`,
                ),
              );
              continue;
            }

            controller.enqueue(
              encoder.encode(
                `event: meta\ndata: ${JSON.stringify(
                  finalizeWorkspacePayload({
                    sources: chunk.sources,
                    demo: chunk.demo,
                    pendingClientCandidates: chunk.pendingClientCandidates,
                    needsClientSelection: chunk.needsClientSelection,
                  }),
                )}\n\n`,
              ),
            );
          }

          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        } catch (error) {
          console.error("[api/ai-workspace] stream", error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: internalError,
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
    const result = await runWorkspaceAi(
      message,
      history,
      mode,
      pendingClientCandidates,
      locale,
    );
    return NextResponse.json(finalizeWorkspacePayload(result));
  } catch (error) {
    console.error("[api/ai-workspace]", error);
    return NextResponse.json(
      {
        reply: internalError,
        sources: [],
        demo: true,
      },
      { status: 200 },
    );
  }
}
