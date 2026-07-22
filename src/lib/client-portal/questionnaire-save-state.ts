/**
 * Derive questionnaire autosave indicator from loaded draft metadata.
 * "idle" = never persisted; "saved" = draft already exists on the server.
 */
export function initialQuestionnaireSaveState(questionnaire: {
  id: string | null;
  status: string;
  revision: number | null;
  lastSavedAt: string | null;
}): "idle" | "saved" {
  if (questionnaire.lastSavedAt) return "saved";
  if (questionnaire.revision !== null && questionnaire.revision >= 1) return "saved";
  if (questionnaire.id && questionnaire.status !== "not_started") return "saved";
  return "idle";
}
