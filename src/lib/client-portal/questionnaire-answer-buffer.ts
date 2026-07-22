/**
 * Pure helpers for stable controlled-input answer updates (typing race fix).
 */

export type AnswerPatchOperation =
  | { op: "set"; questionId: string; value: unknown }
  | { op: "clear"; questionId: string };

export function applyLocalAnswerOperation(
  prev: Record<string, unknown>,
  operation: AnswerPatchOperation,
): Record<string, unknown> {
  if (operation.op === "clear") {
    return Object.fromEntries(
      Object.entries(prev).filter(([key]) => key !== operation.questionId),
    );
  }
  return { ...prev, [operation.questionId]: operation.value };
}

/** Simulate rapid keystrokes against a stale-closure bug vs functional updates. */
export function applyRapidKeystrokes(
  initial: Record<string, unknown>,
  questionId: string,
  keys: string[],
  mode: "stale" | "functional",
): Record<string, unknown> {
  if (mode === "functional") {
    let state = { ...initial };
    for (const key of keys) {
      const nextValue = `${String(state[questionId] ?? "")}${key}`;
      state = applyLocalAnswerOperation(state, {
        op: "set",
        questionId,
        value: nextValue,
      });
    }
    return state;
  }

  // Buggy path: each keystroke spreads a frozen stale snapshot (pre-React-commit).
  let published = { ...initial };
  for (const key of keys) {
    const stale = published;
    const nextValue = `${String(stale[questionId] ?? "")}${key}`;
    published = { ...stale, [questionId]: nextValue };
    // Simulate lost intermediate commits: only last assignment "wins" from same stale base
    // when multiple events fire before re-render — approximate by resetting to initial each time
    // after the first character when keys are batched on same stale state.
  }
  // Stronger stale simulation: all keystrokes apply against the same initial snapshot.
  let last = { ...initial };
  for (const key of keys) {
    last = {
      ...initial,
      [questionId]: `${String(initial[questionId] ?? "")}${key}`,
    };
  }
  return last;
}
