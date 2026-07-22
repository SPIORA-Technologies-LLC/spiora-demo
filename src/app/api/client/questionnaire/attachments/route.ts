import { randomUUID } from "node:crypto";
import { getClientSession } from "@/lib/client-portal/session";
import { getClientQuestionnaire } from "@/lib/client-portal/questionnaire";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { isAllowedQuestionnaireAttachment, isQuestionnaireFileAnswer } from "@/lib/client-portal/questionnaire-attachment-formats";
import {
  deleteQuestionnaireAttachmentFile,
  saveQuestionnaireAttachmentFile,
} from "@/lib/client-portal/questionnaire-attachment-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return clientApiError("INVALID_BODY", 400);
  }

  const questionId = String(formData.get("questionId") ?? "");
  const fileEntry = formData.get("file");
  if (!questionId || !(fileEntry instanceof File)) {
    return clientApiError("INVALID_BODY", 400);
  }

  const question = current.data.template.schema.sections
    .flatMap((section) => section.questions)
    .find((item) => item.id === questionId);
  if (!question || question.type !== "file") {
    return clientApiError("QUESTIONNAIRE_FIELD_UNKNOWN", 400);
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const allowed = isAllowedQuestionnaireAttachment(
    fileEntry.name || "file",
    fileEntry.type || "application/octet-stream",
    buffer.length,
  );
  if (!allowed.ok) {
    return Response.json(
      {
        error: {
          code: allowed.reason === "too_large" ? "FILE_TOO_LARGE" : "UNSUPPORTED_FILE_TYPE",
          message:
            allowed.reason === "too_large"
              ? "File too large"
              : "Unsupported file type",
        },
      },
      { status: allowed.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const previous = current.data.questionnaire.answers[questionId];
  const attachmentId = randomUUID();
  const fileName = (fileEntry.name || "file").slice(0, 255);

  try {
    await saveQuestionnaireAttachmentFile(
      session.invitationId,
      attachmentId,
      fileName,
      buffer,
      allowed.mimeType,
    );
  } catch {
    return clientApiError("INTERNAL", 500);
  }

  if (isQuestionnaireFileAnswer(previous) && previous.id !== attachmentId) {
    void deleteQuestionnaireAttachmentFile(
      session.invitationId,
      previous.id,
      previous.fileName,
    );
  }

  return clientApiOk({
    attachment: {
      id: attachmentId,
      fileName,
      mimeType: allowed.mimeType,
      sizeBytes: buffer.length,
      questionId,
    },
  });
}
