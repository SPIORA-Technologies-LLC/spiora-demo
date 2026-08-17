import { CALENDAR_TIMEZONE } from "@/lib/calendar/constants";
import type { UserRole } from "@/lib/auth/types";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const KNOWN_ROLES: UserRole[] = ["owner", "manager", "finance_manager"];

function listEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerRolesFromEnv(): UserRole[] {
  const roles = listEnv("SPIORA_SIGN_PROVIDER_ROLES").filter((role): role is UserRole =>
    KNOWN_ROLES.includes(role as UserRole),
  );
  return roles.length > 0 ? roles : ["owner"];
}

export function getSignConfig() {
  return {
    otpTtlSeconds: intEnv("SPIORA_SIGN_OTP_TTL_SECONDS", 600),
    otpMaxAttempts: intEnv("SPIORA_SIGN_OTP_MAX_ATTEMPTS", 5),
    otpResendSeconds: intEnv("SPIORA_SIGN_OTP_RESEND_SECONDS", 60),
    otpHourlyLimit: intEnv("SPIORA_SIGN_OTP_HOURLY_LIMIT", 8),
    providerRoles: providerRolesFromEnv(),
    providerUserIds: listEnv("SPIORA_SIGN_PROVIDER_USER_IDS"),
    timezone: process.env.SPIORA_SIGN_TIMEZONE?.trim() || CALENDAR_TIMEZONE,
    pdfUrlTtlSeconds: intEnv("SPIORA_SIGN_PDF_URL_TTL_SECONDS", 180),
  };
}
