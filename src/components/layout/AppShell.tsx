import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShellNotifications } from "./AppShellNotifications";
import { AppShellClient } from "./AppShellClient";
import type { TopbarProps } from "./Topbar";
import { getSession } from "@/lib/auth/session";
import type { AppLocale } from "@/i18n/config";
import { translateTeamMemberName } from "@/i18n/team-members";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import { MfaReenrollBanner } from "@/components/auth/MfaReenrollBanner";
import { EmployeeMfaOnboardingHost } from "@/components/auth/EmployeeMfaOnboardingHost";

export type AppShellProps = Omit<TopbarProps, "userName" | "userRole"> & {
  children: ReactNode;
  contentClassName?: string;
};

export async function AppShell({
  children,
  sectionTitle,
  searchPlaceholder,
  defaultSearchValue,
  onSearchChange,
  contentClassName,
}: AppShellProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("shell");
  const showMfaBanner =
    isEmployeeMfaEnabled() && Boolean(session.mfaReenrollRequired);

  return (
    <AppShellNotifications>
      <AppShellClient
        role={session.role}
        autoOpenMobileNav
        sectionTitle={sectionTitle}
        userName={translateTeamMemberName(locale, session.id, session.name)}
        userRole={
          session
            ? session.role === "owner"
              ? t("roleOwner")
              : session.role === "finance_manager"
                ? t("roleFinanceManager")
                : t("roleManager")
            : ""
        }
        searchPlaceholder={searchPlaceholder}
        defaultSearchValue={defaultSearchValue}
        onSearchChange={onSearchChange}
        contentClassName={contentClassName}
      >
        {showMfaBanner ? <MfaReenrollBanner /> : null}
        {isEmployeeMfaEnabled() ? (
          <EmployeeMfaOnboardingHost userId={session.id} />
        ) : null}
        {children}
      </AppShellClient>
    </AppShellNotifications>
  );
}
