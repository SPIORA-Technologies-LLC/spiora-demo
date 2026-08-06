import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import styles from "@/components/client-portal/ClientInvitePage.module.css";

export default async function ClientChangePasswordPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "1.5rem 1rem 2.5rem",
      }}
    >
      <div className={styles.card} style={{ maxWidth: "28rem", width: "100%" }}>
        <ChangePasswordForm audience="client" />
      </div>
    </main>
  );
}
