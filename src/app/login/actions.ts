"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canAccessPath } from "@/lib/auth/permissions";
import { checkLoginRateLimit } from "@/lib/auth/login-rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  findUserByEmail,
  toSessionUser,
} from "@/lib/auth/users";
import { verifyUserPassword } from "@/lib/auth/verify-password";
import { isUserDeleted } from "@/lib/team/store";

export type SignInState = {
  error?: string;
  redirectTo?: string;
};

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const t = await getTranslations("auth");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "").trim();

  if (!email || !password) {
    return { error: t("missingCredentials") };
  }

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    undefined;
  const rateLimit = checkLoginRateLimit(email, ip);
  if (!rateLimit.allowed) {
    return { error: t("rateLimitExceeded") };
  }

  const user = findUserByEmail(email);
  if (!user) {
    return { error: t("emailNotRegistered") };
  }

  if (await isUserDeleted(user.id)) {
    return { error: t("accountDisabled") };
  }

  const valid = await verifyUserPassword(user, password);
  if (!valid) {
    return { error: t("invalidCredentials") };
  }

  const sessionUser = toSessionUser(user);
  await createSession(sessionUser);

  const destination =
    nextPath && canAccessPath(sessionUser.role, nextPath)
      ? nextPath
      : "/dashboard";

  return { redirectTo: destination };
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
