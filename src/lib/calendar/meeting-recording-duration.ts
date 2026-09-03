/**
 * LiveKit FileInfo.duration is nanoseconds (int64).
 * Our DB column duration_seconds is Postgres int (~2.1e9 max).
 * Storing raw nanoseconds overflows and rolls back the complete save.
 */
export function liveKitDurationToSeconds(
  raw: bigint | number | null | undefined,
): number | null {
  if (raw == null) {
    return null;
  }

  const value = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // Values already in seconds stay as-is (tests / small mocks).
  // LiveKit nanoseconds for a real call are always >> 1e9 (1 second).
  const seconds =
    value >= 1_000_000_000 ? Math.round(value / 1_000_000_000) : Math.round(value);

  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 2_000_000_000) {
    return null;
  }

  return seconds;
}

export function liveKitFileSizeToBytes(
  raw: bigint | number | null | undefined,
): number | null {
  if (raw == null) {
    return null;
  }

  const value = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return Math.round(value);
}

export type LiveKitFileResultLike = {
  filename?: string;
  size?: bigint | number;
  duration?: bigint | number;
};

/** Prefer fileResults; fall back to deprecated result.file when empty. */
export function collectLiveKitFileResults(info: {
  fileResults?: LiveKitFileResultLike[];
  result?: { case: string; value?: LiveKitFileResultLike } | null;
}): LiveKitFileResultLike[] {
  const fromResults = [...(info.fileResults ?? [])];
  if (fromResults.length > 0) {
    return fromResults;
  }

  if (info.result?.case === "file" && info.result.value) {
    return [info.result.value];
  }

  return [];
}
