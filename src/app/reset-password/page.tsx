import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PasswordAuthShell } from "@/components/auth/PasswordAuthShell";

export default function ResetPasswordPage() {
  return (
    <PasswordAuthShell audience="employee">
      <ResetPasswordForm audience="employee" />
    </PasswordAuthShell>
  );
}
