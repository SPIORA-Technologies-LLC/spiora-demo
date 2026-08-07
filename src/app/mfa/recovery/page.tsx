import { MfaRecoveryForm } from "@/components/auth/MfaRecoveryForm";
import styles from "@/app/login/login.module.css";

export default function MfaRecoveryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <MfaRecoveryForm />
      </div>
    </main>
  );
}
