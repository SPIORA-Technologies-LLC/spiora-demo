import { formatClientForAi } from "@/lib/ai/format-client";
import type { ClientDetail } from "@/lib/google-sheets/types";

export function buildClientAiContext(detail: ClientDetail): string {
  const { client, surveys, documents, notes } = detail;

  const surveysText =
    surveys.length > 0
      ? surveys
          .map(
            (s) =>
              `- ${s.title} (${s.filledAt}), статус: ${s.processingStatus}`,
          )
          .join("\n")
      : "Нет анкет";

  const docsText =
    documents.length > 0
      ? documents
          .map((d) => `- ${d.name} [${d.category}], ${d.uploadedAt}`)
          .join("\n")
      : "Нет документов";

  const notesText =
    notes.length > 0
      ? notes.map((n) => `${n.createdAt} (${n.author}): ${n.text}`).join("\n")
      : "Нет заметок";

  return `
${formatClientForAi(client)}
ID в системе: ${client.id}
Телефон: ${client.phone}
Email: ${client.email}

Анкеты:
${surveysText}

Документы:
${docsText}

Заметки менеджеров:
${notesText}
`.trim();
}
