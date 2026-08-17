import type { SessionUser } from "@/lib/auth/types";
import { getSignConfig } from "./config";

export const CONTRACTS_SIGN_AS_PROVIDER = "contracts.sign_as_provider";

export function canSignConsultingAgreementAsProvider(
  user: Pick<SessionUser, "id" | "role">,
): boolean {
  const config = getSignConfig();
  if (config.providerUserIds.includes(user.id)) return true;
  return config.providerRoles.includes(user.role);
}

export function providerTitleForRole(
  role: SessionUser["role"],
  locale: "en" | "ru",
): string {
  if (locale === "ru") {
    if (role === "owner") return "Директор";
    if (role === "finance_manager") return "Бухгалтер";
    return "Менеджер";
  }
  if (role === "owner") return "Director";
  if (role === "finance_manager") return "Finance manager";
  return "Manager";
}
