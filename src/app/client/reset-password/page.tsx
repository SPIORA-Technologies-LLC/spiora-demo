import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PasswordAuthShell } from "@/components/auth/PasswordAuthShell";

export default function ClientResetPasswordPage() {
  return (
    <PasswordAuthShell audience="client">
      <ResetPasswordForm audience="client" />
    </PasswordAuthShell>
  );
}
