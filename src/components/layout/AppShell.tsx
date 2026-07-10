import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShellNotifications } from "./AppShellNotifications";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";
import { getSession } from "@/lib/auth/session";
import styles from "./AppShell.module.css";

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
    <div className={styles.shell}>
      <Sidebar role={session.role} />
      <AppShellNotifications>
        <div className={styles.main}>
          <Topbar
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
          />
          <main
            className={[styles.content, contentClassName]
              .filter(Boolean)
              .join(" ")}
          >
            {children}
          </main>
        </div>
      </AppShellNotifications>
    </div>
  );
}
