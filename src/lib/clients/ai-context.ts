import type { ClientDetail } from "@/lib/google-sheets/types";
import { formatClientForAi } from "@/lib/ai/format-client";

const MAX_NOTES_IN_CONTEXT = 8;
const MAX_DOCUMENTS_IN_CONTEXT = 10;
const MAX_NOTE_CHARS = 500;

function trimText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function buildClientAiContext(detail: ClientDetail): string {
  const { client, surveys, documents, notes } = detail;

  const surveysText =
    surveys.length > 0
      ? surveys
          .slice(0, 5)
          .map(
            (s) =>
              `- ${s.title} (${s.filledAt}), статус: ${s.processingStatus}`,
          )
          .join("\n")
      : "Нет анкет";

  const docsText =
    documents.length > 0
      ? documents
          .slice(0, MAX_DOCUMENTS_IN_CONTEXT)
          .map(
            (d) =>
              `- ${d.name} [${d.documentType ?? d.category}] · статус: ${d.status ?? "unknown"} · ${d.uploadedAt}`,
          )
          .join("\n")
      : "Нет документов";

  const notesText =
    notes.length > 0
      ? notes
          .slice(0, MAX_NOTES_IN_CONTEXT)
          .map(
            (n) =>
              `${n.createdAt} (${n.author}): ${trimText(n.text, MAX_NOTE_CHARS)}`,
          )
          .join("\n")
      : "Нет заметок";

  return `
${formatClientForAi(client)}
ID в системе: ${client.id}
Телефон: ${client.phone}
Email: ${client.email}

Анкеты:
${surveysText}

Документы (метаданные):
${docsText}

Заметки менеджеров:
${notesText}
`.trim();
}
