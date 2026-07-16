"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canAccessPath } from "@/lib/auth/permissions";
import { checkProductionSafeLoginRateLimit } from "@/lib/auth/login-rate-limit-store";
import {
  createSession,
  destroySession,
} from "@/lib/auth/session";
import {
  findUserByEmail,
  toSessionUser,
} from "@/lib/auth/users";
import { verifyUserPassword } from "@/lib/auth/verify-password";
import { isUserDeleted } from "@/lib/team/store";
import { getAuthProvider, isLegacyAuthAllowed } from "@/lib/auth/provider";
import {
  checkRequestOrigin,
  resolvePostLoginPath,
} from "@/lib/auth/security";
import {
  signInWithSupabasePassword,
  signOutSupabaseAuth,
} from "@/lib/auth/supabase-login";

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
  const origin = headerStore.get("origin");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const originCheck = checkRequestOrigin(origin, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return { error: t("invalidCredentials") };
  }

  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    undefined;
  const rateLimit = await checkProductionSafeLoginRateLimit(email, ip);
  if (!rateLimit.allowed) {
    return { error: t("rateLimitExceeded") };
  }

  const provider = getAuthProvider();

  if (provider === "supabase") {
    const result = await signInWithSupabasePassword(email, password);
    if (!result.ok) {
      switch (result.code) {
        case "missing_profile":
        case "suspended":
        case "archived":
        case "inactive":
          return { error: t("accountDisabled") };
        case "auth_unavailable":
          // No silent fallback to legacy passwords.
          return { error: t("invalidCredentials") };
        default:
          return { error: t("invalidCredentials") };
      }
    }

    const destination = resolvePostLoginPath(nextPath, (path) =>
      canAccessPath(result.session.role, path),
    );
    return { redirectTo: destination };
  }

  // Legacy path — local only when explicitly allowed.
  if (!isLegacyAuthAllowed()) {
    return { error: t("invalidCredentials") };
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

  const destination = resolvePostLoginPath(nextPath, (path) =>
    canAccessPath(sessionUser.role, path),
  );

  return { redirectTo: destination };
}

export async function signOutAction(): Promise<void> {
  const provider = getAuthProvider();
  if (provider === "supabase") {
    await signOutSupabaseAuth();
  }
  await destroySession();
  redirect("/login");
}
