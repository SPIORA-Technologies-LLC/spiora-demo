import { createHash } from "node:crypto";
import type { QuestionnaireSchema } from "./questionnaire-types";

export class CanonicalJsonError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CanonicalJsonError";
    this.code = code;
  }
}

function assertPlainObject(value: object): asserts value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalJsonError(
      "UNSUPPORTED_OBJECT",
      "Only plain objects are supported in canonical JSON",
    );
  }
}

/**
 * Deep-canonicalize a JSON-compatible value:
 * - recursively sort object keys
 * - preserve array order
 * - accept string | number | boolean | null | plain object | array
 * - reject undefined, function, bigint, symbol, NaN, Infinity, non-plain objects
 */
export function canonicalizeJsonValue(value: unknown): unknown {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return value;

  if (valueType === "number") {
    if (!Number.isFinite(value as number)) {
      throw new CanonicalJsonError(
        "NON_FINITE_NUMBER",
        "NaN and Infinity are not allowed in canonical JSON",
      );
    }
    // Normalize -0 to 0 for stable encoding.
    return Object.is(value, -0) ? 0 : value;
  }

  if (valueType === "undefined") {
    throw new CanonicalJsonError("UNDEFINED", "undefined is not allowed in canonical JSON");
  }
  if (valueType === "bigint") {
    throw new CanonicalJsonError("BIGINT", "BigInt is not allowed in canonical JSON");
  }
  if (valueType === "function" || valueType === "symbol") {
    throw new CanonicalJsonError(
      "UNSUPPORTED_TYPE",
      `${valueType} is not allowed in canonical JSON`,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (valueType === "object") {
    assertPlainObject(value as object);
    const input = value as Record<string, unknown>;
    const sortedKeys = Object.keys(input).sort();
    const output: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const child = input[key];
      if (child === undefined) {
        throw new CanonicalJsonError(
          "UNDEFINED",
          `undefined property is not allowed: ${key}`,
        );
      }
      output[key] = canonicalizeJsonValue(child);
    }
    return output;
  }

  throw new CanonicalJsonError("UNSUPPORTED_TYPE", "Unsupported value in canonical JSON");
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

export function hashCanonicalJson(value: unknown): string {
  const canonical = canonicalizeJson(value);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function hashQuestionnaireSchema(schema: QuestionnaireSchema): string {
  return hashCanonicalJson(schema);
}

/** Fixed canonical hash for general_client_onboarding demo schema (current). */
export const GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH =
  "db01cd23fa948b1c98615b3a23db971ccfaabc19bd03c43df3bcb9ddc0d923e7";

/**
 * Previously published hashes for the same demo template.
 * Used to reconcile/upgrade stored rows to the in-code schema without SQL.
 */
export const GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH_LEGACY = [
  "33eabda0ac9cb6f7a0940f615f1fd6d55f1880e1891ee6bb80e6689dc5d4d1ca",
  "222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac",
  "50bec4ccae383615d9a84d5658cebbe33cbee27852da2395d89c7ab080b882f9",
  "2f43b03dbc7644e1220ab9b61e4bfe490dd834e34516e06e7f37d0f7bee2b577",
  "5787bdf22ecd22b6bb0a8dd9261279946b60173af2486c4e630b3620c2d49451",
] as const;
