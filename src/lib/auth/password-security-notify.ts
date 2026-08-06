import "server-only";

import { sendEmail } from "@/lib/mail/send-email";
import { isMailConfigured } from "@/lib/mail/config";
import type { PasswordRecoveryAudience } from "./password-recovery-gate";

export async function sendPasswordSecurityNotification(input: {
  to: string;
  audience: PasswordRecoveryAudience;
  kind: "changed" | "reset";
  truncatedIp?: string | null;
}): Promise<void> {
  if (!isMailConfigured()) return;

  const subject =
    input.kind === "changed"
      ? "Spiora password changed"
      : "Spiora password reset completed";

  const plane =
    input.audience === "employee" ? "team account" : "client portal account";
  const ipLine = input.truncatedIp
    ? `Approximate network: ${input.truncatedIp}\n`
    : "";

  const text = [
    `Your Spiora ${plane} password was ${input.kind === "changed" ? "changed" : "reset"}.`,
    "",
    ipLine.trimEnd(),
    "If you did not make this change, reset your password immediately and contact support at info@spiora.ai.",
    "",
    "This message does not include your password.",
  ]
    .filter((line, index, arr) => {
      if (line === "" && arr[index - 1] === "") return false;
      return true;
    })
    .join("\n");

  await sendEmail({
    to: input.to,
    subject,
    text,
  });
}
