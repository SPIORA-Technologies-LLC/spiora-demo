import { getClientSession } from "@/lib/client-portal/session";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { redirect } from "next/navigation";
import { ClientMfaSettingsPanel } from "@/components/client-portal/ClientMfaSettingsPanel";
import styles from "@/components/client-portal/ClientInvitePage.module.css";

export default async function ClientMfaSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  if (!isClientMfaEnabled()) redirect("/client");

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "1.5rem 1rem 2.5rem",
      }}
    >
      <div className={styles.card} style={{ maxWidth: "34rem", width: "100%" }}>
        <ClientMfaSettingsPanel />
      </div>
    </main>
  );
}
