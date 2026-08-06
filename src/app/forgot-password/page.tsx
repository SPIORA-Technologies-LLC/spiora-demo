import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { PasswordAuthShell } from "@/components/auth/PasswordAuthShell";

export default function ForgotPasswordPage() {
  return (
    <PasswordAuthShell audience="employee">
      <ForgotPasswordForm audience="employee" />
    </PasswordAuthShell>
  );
}
