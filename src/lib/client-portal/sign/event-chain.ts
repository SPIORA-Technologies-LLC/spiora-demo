type ChainEvent = {
  id: string;
  eventHash: string;
  previousEventHash: string;
  occurredAt: string;
};

/** True chain tip: an event that no later event points to as previous. */
export function pickChainTip<T extends ChainEvent>(events: T[]): T | null {
  if (events.length === 0) return null;
  const pointedTo = new Set(events.map((event) => event.previousEventHash));
  const tips = events.filter((event) => !pointedTo.has(event.eventHash));
  if (tips.length === 1) return tips[0];
  if (tips.length === 0) return events[events.length - 1] ?? null;
  return [...tips].sort((a, b) => {
    const time = a.occurredAt.localeCompare(b.occurredAt);
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  }).at(-1) ?? null;
}
