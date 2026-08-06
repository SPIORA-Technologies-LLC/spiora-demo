import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { PasswordAuthShell } from "@/components/auth/PasswordAuthShell";

export default function ClientForgotPasswordPage() {
  return (
    <PasswordAuthShell audience="client">
      <ForgotPasswordForm audience="client" />
    </PasswordAuthShell>
  );
}
