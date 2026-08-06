import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default async function ClientChangePasswordPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <ChangePasswordForm audience="client" />
    </main>
  );
}
