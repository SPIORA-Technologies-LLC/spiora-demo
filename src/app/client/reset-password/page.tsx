import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ClientResetPasswordPage() {
  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <ResetPasswordForm audience="client" />
    </main>
  );
}
