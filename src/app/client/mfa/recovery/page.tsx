import { ClientMfaRecoveryForm } from "@/components/client-portal/ClientMfaRecoveryForm";
import styles from "@/app/login/login.module.css";

export default function ClientMfaRecoveryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <ClientMfaRecoveryForm />
      </div>
    </main>
  );
}
