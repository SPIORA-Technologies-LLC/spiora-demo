import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShellNotifications } from "./AppShellNotifications";
import { AppShellClient } from "./AppShellClient";
import type { TopbarProps } from "./Topbar";
import { getSession } from "@/lib/auth/session";

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

  const t = await getTranslations("shell");

  return (
    <AppShellNotifications>
      <AppShellClient
        role={session.role}
        autoOpenMobileNav
        sectionTitle={sectionTitle}
        userName={session?.name ?? t("userFallback")}
        userRole={
          session
            ? session.role === "owner"
              ? t("roleOwner")
              : t("roleManager")
            : ""
        }
        searchPlaceholder={searchPlaceholder}
        defaultSearchValue={defaultSearchValue}
        onSearchChange={onSearchChange}
        contentClassName={contentClassName}
      >
        {children}
      </AppShellClient>
    </AppShellNotifications>
  );
}
