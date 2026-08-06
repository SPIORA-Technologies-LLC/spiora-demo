import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import styles from "@/app/login/login.module.css";

export default async function EmployeeChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div className={styles.card} style={{ maxWidth: 440, width: "100%" }}>
        <ChangePasswordForm audience="employee" />
      </div>
    </main>
  );
}
