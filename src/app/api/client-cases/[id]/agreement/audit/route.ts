import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequestLocale, translateApiMessage } from "@/i18n/api-messages";
import { getSignVersionForCase, listSignAudit } from "@/lib/client-portal/sign/service";
import { canSignConsultingAgreementAsProvider } from "@/lib/client-portal/sign/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "unauthorized") },
      { status: 401 },
    );
  }
  if (session.role !== "owner" && session.role !== "manager") {
    return NextResponse.json(
      { error: translateApiMessage(locale, "forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const versionId = new URL(request.url).searchParams.get("versionId");
  const found = await getSignVersionForCase(id, versionId);
  if (!found) {
    return NextResponse.json(
      { error: translateApiMessage(locale, "notFound") },
      { status: 404 },
    );
  }

  const events = await listSignAudit(found.version.id);
  return NextResponse.json(
    {
      versionId: found.version.id,
      transactionId: found.version.transactionId,
      canSignAsProvider: canSignConsultingAgreementAsProvider(session),
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actor: event.actorType,
        actorType: event.actorType,
        occurredAt: event.occurredAt,
        documentHash: event.documentHash,
        metadata: event.metadata,
        ...(session.role === "owner"
          ? {
              ipAddress: event.ipAddress,
              userAgent: event.userAgent,
              eventHash: event.eventHash,
              previousEventHash: event.previousEventHash,
            }
          : {}),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
