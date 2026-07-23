/**
 * Country field helpers: users pick localized names; answers store ISO 3166-1 alpha-2.
 * Safe for client bundles (no node:crypto).
 */

import type {
  QuestionnaireAnswers,
  QuestionnaireSchema,
} from "./questionnaire-types";

export type CountryOption = {
  value: string;
  label: string;
};

/** Common ISO 3166-1 alpha-2 codes (Intl.DisplayNames regions). */
export const ISO_COUNTRY_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

/** Extra aliases users often type (normalized lookup keys → ISO). */
const COUNTRY_ALIASES: Record<string, string> = {
  russia: "RU",
  "russian federation": "RU",
  рф: "RU",
  россия: "RU",
  "российская федерация": "RU",
  croatia: "HR",
  хорватия: "HR",
  armenia: "AM",
  армения: "AM",
  georgia: "GE",
  грузия: "GE",
  kazakhstan: "KZ",
  казахстан: "KZ",
  ukraine: "UA",
  украина: "UA",
  belarus: "BY",
  беларусь: "BY",
  белоруссия: "BY",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  germany: "DE",
  deutschland: "DE",
  германия: "DE",
  france: "FR",
  франция: "FR",
  italy: "IT",
  италия: "IT",
  spain: "ES",
  испания: "ES",
  poland: "PL",
  польша: "PL",
  turkey: "TR",
  türkiye: "TR",
  турция: "TR",
  israel: "IL",
  израиль: "IL",
  cyprus: "CY",
  кипр: "CY",
  montenegro: "ME",
  черногория: "ME",
  serbia: "RS",
  сербия: "RS",
  "north macedonia": "MK",
  macedonia: "MK",
  македония: "MK",
  "bosnia and herzegovina": "BA",
  bosnia: "BA",
  босния: "BA",
  "bosnia & herzegovina": "BA",
};

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

let nameIndexCache: Map<string, string> | null = null;

function buildNameIndex(): Map<string, string> {
  if (nameIndexCache) return nameIndexCache;
  const index = new Map<string, string>();

  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    index.set(normalizeLookupKey(alias), code);
  }

  for (const locale of ["en", "ru"] as const) {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      display = null;
    }
    for (const code of ISO_COUNTRY_CODES) {
      index.set(normalizeLookupKey(code), code);
      if (!display) continue;
      try {
        const label = display.of(code);
        if (label) index.set(normalizeLookupKey(label), code);
      } catch {
        // ignore unsupported codes in runtime
      }
    }
  }

  nameIndexCache = index;
  return index;
}

export function isIsoCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value) && ISO_COUNTRY_CODES.includes(value);
}

/**
 * Resolve free-text / ISO input to ISO alpha-2, or null if unknown.
 */
export function resolveCountryToIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    if (ISO_COUNTRY_CODES.includes(upper)) return upper;
  }

  const key = normalizeLookupKey(trimmed);
  return buildNameIndex().get(key) ?? null;
}

export function countryLabel(code: string, locale: "en" | "ru"): string {
  const iso = resolveCountryToIso(code) ?? code.trim().toUpperCase();
  try {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return names.of(iso) || iso;
  } catch {
    return iso;
  }
}

export function getCountryOptions(locale: "en" | "ru"): CountryOption[] {
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    display = null;
  }

  const options: CountryOption[] = [];
  for (const code of ISO_COUNTRY_CODES) {
    let label = code;
    if (display) {
      try {
        label = display.of(code) || code;
      } catch {
        label = code;
      }
    }
    options.push({ value: code, label });
  }

  return options.sort((a, b) =>
    a.label.localeCompare(b.label, locale === "ru" ? "ru" : "en", {
      sensitivity: "base",
    }),
  );
}

/** Normalize country-type answers to ISO codes in a copy of answers. */
export function normalizeCountryAnswers(
  schema: QuestionnaireSchema,
  answers: QuestionnaireAnswers,
): QuestionnaireAnswers {
  const next: QuestionnaireAnswers = { ...answers };
  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (question.type !== "country") continue;
      if (!(question.id in next)) continue;
      const current = next[question.id];
      if (current == null || current === "") continue;
      const iso = resolveCountryToIso(current);
      if (iso) next[question.id] = iso;
    }
  }
  return next;
}
