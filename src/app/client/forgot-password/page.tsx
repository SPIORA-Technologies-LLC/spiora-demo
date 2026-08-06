import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ClientForgotPasswordPage() {
  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <ForgotPasswordForm audience="client" />
    </main>
  );
}
