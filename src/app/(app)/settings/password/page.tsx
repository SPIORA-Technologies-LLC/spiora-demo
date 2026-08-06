import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default async function EmployeeChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <ChangePasswordForm audience="employee" />
    </main>
  );
}
