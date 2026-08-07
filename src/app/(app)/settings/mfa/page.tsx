import { getSession } from "@/lib/auth/session";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import { redirect } from "next/navigation";
import { MfaSettingsPanel } from "@/components/auth/MfaSettingsPanel";
import styles from "@/app/login/login.module.css";

export default async function EmployeeMfaSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isEmployeeMfaEnabled()) redirect("/settings");

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div className={styles.card} style={{ maxWidth: 480, width: "100%" }}>
        <MfaSettingsPanel />
      </div>
    </main>
  );
}
