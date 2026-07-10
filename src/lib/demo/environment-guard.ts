import {
  isDemoMode,
  isTruthyEnv,
  parseCsvEnv,
} from "./demo-mode";

export type EnvironmentViolation = {
  code: string;
  message: string;
  variable?: string;
};

type EnvRecord = Record<string, string | undefined>;

/** Public deployment name patterns — not secret refs. Server-only guard. */
const DEFAULT_BLOCKED_URL_SUBSTRINGS = [
  "sharp-spice-team-platform",
  "emigrant-croatia-desk",
  "Sharp-Spice-Team-Platform",
];

const URL_SCAN_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "EMIGRANT_SUPABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "LIVEKIT_URL",
  "OPENROUTER_HTTP_REFERER",
  "LIVEKIT_EGRESS_S3_ENDPOINT",
  "SPIORA_CRON_TARGET_URL",
] as const;

const WEBHOOK_SCAN_VARIABLES = [
  "SPIORA_WEBHOOK_URL",
  "LIVEKIT_WEBHOOK_URL",
] as const;

const GOOGLE_SPREADSHEET_VARIABLES = [
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID",
] as const;

const GOOGLE_DRIVE_VARIABLES = [
  "GOOGLE_DRIVE_KB_FOLDER_ID",
  "GOOGLE_DRIVE_EMIGRANT_FOLDER_ID",
] as const;

export function extractSupabaseProjectRef(url: string): string | null {
  const match = url.trim().match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function envValue(env: EnvRecord, name: string): string {
  return env[name]?.trim() ?? "";
}

function blockedUrlSubstrings(env: EnvRecord): string[] {
  return [
    ...DEFAULT_BLOCKED_URL_SUBSTRINGS,
    ...parseCsvEnvFrom(env, "SPIORA_BLOCKED_URL_SUBSTRINGS"),
  ];
}

function parseCsvEnvFrom(env: EnvRecord, name: string): string[] {
  const raw = env[name]?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function containsBlockedUrlSubstring(
  env: EnvRecord,
  value: string,
): string | null {
  for (const pattern of blockedUrlSubstrings(env)) {
    if (pattern && value.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

function checkBlockedUrls(env: EnvRecord): EnvironmentViolation[] {
  const violations: EnvironmentViolation[] = [];

  for (const variable of [...URL_SCAN_VARIABLES, ...WEBHOOK_SCAN_VARIABLES]) {
    const value = envValue(env, variable);
    if (!value) continue;

    const pattern = containsBlockedUrlSubstring(env, value);
    if (pattern) {
      violations.push({
        code: "blocked_production_url",
        variable,
        message: `${variable} содержит запрещённый фрагмент production-URL «${pattern}». Используйте demo-окружение или очистите переменную.`,
      });
    }
  }

  return violations;
}

function checkSupabaseRefs(env: EnvRecord): EnvironmentViolation[] {
  const violations: EnvironmentViolation[] = [];
  const blockedRefs = new Set(
    parseCsvEnvFrom(env, "SPIORA_BLOCKED_SUPABASE_PROJECT_REFS").map((ref) =>
      ref.toLowerCase(),
    ),
  );
  const allowedRefs = parseCsvEnvFrom(
    env,
    "SPIORA_ALLOWED_SUPABASE_PROJECT_REFS",
  ).map((ref) => ref.toLowerCase());

  const supabaseUrl = envValue(env, "NEXT_PUBLIC_SUPABASE_URL");
  const emigrantUrl = envValue(env, "EMIGRANT_SUPABASE_URL");

  for (const [variable, url] of [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["EMIGRANT_SUPABASE_URL", emigrantUrl],
  ] as const) {
    if (!url) continue;
    const ref = extractSupabaseProjectRef(url);
    if (!ref) continue;

    if (blockedRefs.has(ref.toLowerCase())) {
      violations.push({
        code: "blocked_supabase_project_ref",
        variable,
        message: `${variable} указывает на запрещённый Supabase project ref «${ref}».`,
      });
    }
  }

  if (isTruthyEnvFrom(env, "SPIORA_ENABLE_SUPABASE") && supabaseUrl) {
    const ref = extractSupabaseProjectRef(supabaseUrl);
    if (!ref) {
      violations.push({
        code: "invalid_supabase_url",
        variable: "NEXT_PUBLIC_SUPABASE_URL",
        message:
          "SPIORA_ENABLE_SUPABASE=true, но NEXT_PUBLIC_SUPABASE_URL не является валидным Supabase URL.",
      });
    } else if (allowedRefs.length === 0) {
      violations.push({
        code: "supabase_allowlist_required",
        variable: "SPIORA_ALLOWED_SUPABASE_PROJECT_REFS",
        message:
          "В demo mode при SPIORA_ENABLE_SUPABASE=true необходимо задать SPIORA_ALLOWED_SUPABASE_PROJECT_REFS с demo project ref.",
      });
    } else if (!allowedRefs.includes(ref.toLowerCase())) {
      violations.push({
        code: "supabase_not_allowlisted",
        variable: "NEXT_PUBLIC_SUPABASE_URL",
        message: `Supabase project ref «${ref}» не входит в SPIORA_ALLOWED_SUPABASE_PROJECT_REFS.`,
      });
    }
  }

  if (isTruthyEnvFrom(env, "SPIORA_ENABLE_EMIGRANT_DESK") && emigrantUrl) {
    const ref = extractSupabaseProjectRef(emigrantUrl);
    if (
      ref &&
      allowedRefs.length > 0 &&
      !allowedRefs.includes(ref.toLowerCase())
    ) {
      violations.push({
        code: "emigrant_supabase_not_allowlisted",
        variable: "EMIGRANT_SUPABASE_URL",
        message: `Emigrant Supabase project ref «${ref}» не входит в SPIORA_ALLOWED_SUPABASE_PROJECT_REFS.`,
      });
    }
  }

  return violations;
}

function isTruthyEnvFrom(env: EnvRecord, name: string): boolean {
  return env[name]?.trim().toLowerCase() === "true";
}

function checkGoogleIds(env: EnvRecord): EnvironmentViolation[] {
  const violations: EnvironmentViolation[] = [];
  const blockedSpreadsheetIds = new Set(
    parseCsvEnvFrom(env, "SPIORA_BLOCKED_GOOGLE_SPREADSHEET_IDS"),
  );
  const blockedFolderIds = new Set(
    parseCsvEnvFrom(env, "SPIORA_BLOCKED_GOOGLE_DRIVE_FOLDER_IDS"),
  );

  for (const variable of GOOGLE_SPREADSHEET_VARIABLES) {
    const value = envValue(env, variable);
    if (!value) continue;
    if (blockedSpreadsheetIds.has(value)) {
      violations.push({
        code: "blocked_spreadsheet_id",
        variable,
        message: `${variable} содержит запрещённый production Spreadsheet ID.`,
      });
    }
  }

  for (const variable of GOOGLE_DRIVE_VARIABLES) {
    const value = envValue(env, variable);
    if (!value) continue;
    if (blockedFolderIds.has(value)) {
      violations.push({
        code: "blocked_drive_folder_id",
        variable,
        message: `${variable} содержит запрещённый production Folder ID.`,
      });
    }
  }

  return violations;
}

function checkExternalSecretsInDemo(env: EnvRecord): EnvironmentViolation[] {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") {
    return [];
  }

  const violations: EnvironmentViolation[] = [];

  if (isTruthyEnvFrom(env, "SPIORA_ENABLE_EXTERNAL_AI")) {
    const hasKey = Boolean(
      envValue(env, "OPENROUTER_API_KEY") || envValue(env, "OPENAI_API_KEY"),
    );
    if (!hasKey) {
      violations.push({
        code: "external_ai_key_missing",
        message:
          "SPIORA_ENABLE_EXTERNAL_AI=true, но OPENROUTER_API_KEY / OPENAI_API_KEY не заданы.",
      });
    }
  }

  if (isTruthyEnvFrom(env, "SPIORA_ENABLE_LIVEKIT")) {
    const hasLiveKit = Boolean(
      envValue(env, "LIVEKIT_URL") &&
        envValue(env, "LIVEKIT_API_KEY") &&
        envValue(env, "LIVEKIT_API_SECRET"),
    );
    if (!hasLiveKit) {
      violations.push({
        code: "livekit_config_incomplete",
        message:
          "SPIORA_ENABLE_LIVEKIT=true, но LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET не заданы полностью.",
      });
    }
  }

  return violations;
}

export function validateDemoEnvironment(
  env: EnvRecord,
): EnvironmentViolation[] {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() !== "true") {
    return [];
  }

  return [
    ...checkBlockedUrls(env),
    ...checkSupabaseRefs(env),
    ...checkGoogleIds(env),
    ...checkExternalSecretsInDemo(env),
  ];
}

export function formatEnvironmentViolations(
  violations: EnvironmentViolation[],
): string {
  const header =
    "Spiora demo mode: обнаружена небезопасная конфигурация окружения.\n" +
    "Исправьте .env.local или отключите SPIORA_ENABLE_* флаги.\n";
  const body = violations
    .map((item, index) => `${index + 1}. [${item.code}] ${item.message}`)
    .join("\n");
  return `${header}\n${body}`;
}

export function assertDemoEnvironmentSafe(
  env: EnvRecord = process.env as EnvRecord,
): void {
  const violations = validateDemoEnvironment(env);
  if (violations.length > 0) {
    throw new Error(formatEnvironmentViolations(violations));
  }
}

export function isDemoModeFromEnv(env: EnvRecord): boolean {
  return env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true";
}

/** Re-export for callers that already import from environment-guard. */
export { isDemoMode };
