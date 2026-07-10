"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canAccessPath } from "@/lib/auth/permissions";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  findUserByEmail,
  toSessionUser,
} from "@/lib/auth/users";
import { verifyUserPassword } from "@/lib/auth/verify-password";
import { isUserDeleted } from "@/lib/team/store";

export type SignInState = {
  error?: string;
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

  if (nextPath && canAccessPath(sessionUser.role, nextPath)) {
    redirect(nextPath);
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
