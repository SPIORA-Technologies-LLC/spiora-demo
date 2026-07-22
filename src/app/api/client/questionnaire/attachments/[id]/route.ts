import { getClientSession } from "@/lib/client-portal/session";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { clientApiError } from "@/lib/client-portal/api-errors";
import { isQuestionnaireFileAnswer } from "@/lib/client-portal/questionnaire-attachment-formats";
import {
  deleteQuestionnaireAttachmentFile,
  readQuestionnaireAttachmentFile,
} from "@/lib/client-portal/questionnaire-attachment-storage";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function findOwnedAttachment(
  answers: Record<string, unknown>,
  attachmentId: string,
) {
  for (const value of Object.values(answers)) {
    if (isQuestionnaireFileAnswer(value) && value.id === attachmentId) {
      return value;
    }
  }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const { id } = await context.params;
  const current = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });
  if (!current.ok) {
    return clientApiError(
      current.code as "QUESTIONNAIRE_NOT_AVAILABLE" | "QUESTIONNAIRE_SCHEMA_INVALID" | "INTERNAL",
      current.code === "QUESTIONNAIRE_NOT_AVAILABLE" ? 404 : 503,
    );
  }

  const owned = findOwnedAttachment(current.data.questionnaire.answers, id);
  if (!owned) return clientApiError("NOT_FOUND", 404);

  const file = await readQuestionnaireAttachmentFile(
    session.invitationId,
    owned.id,
    owned.fileName,
  );
  if (!file) return clientApiError("NOT_FOUND", 404);

  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(owned.fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  const { id } = await context.params;
  const current = await getClientQuestionnaire({
    portalUserId: session.id,
    invitationId: session.invitationId,
    portalEmail: session.email,
    templateKey: null,
  });
  if (!current.ok) {
    return clientApiError(
      current.code as "QUESTIONNAIRE_NOT_AVAILABLE" | "QUESTIONNAIRE_SCHEMA_INVALID" | "INTERNAL",
      current.code === "QUESTIONNAIRE_NOT_AVAILABLE" ? 404 : 503,
    );
  }

  const status = current.data.questionnaire.status;
  if (status === "in_review" || status === "submitted" || status === "locked") {
    return clientApiError("QUESTIONNAIRE_READ_ONLY", 400);
  }

  const owned = findOwnedAttachment(current.data.questionnaire.answers, id);
  if (!owned) return clientApiError("NOT_FOUND", 404);

  await deleteQuestionnaireAttachmentFile(
    session.invitationId,
    owned.id,
    owned.fileName,
  );

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
