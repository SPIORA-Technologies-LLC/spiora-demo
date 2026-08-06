import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <ForgotPasswordForm audience="employee" />
    </main>
  );
}
