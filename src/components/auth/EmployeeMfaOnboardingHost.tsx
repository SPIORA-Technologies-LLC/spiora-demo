"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  hasSeenEmployeeMfaOnboarding,
  markEmployeeMfaOnboardingSeen,
} from "@/lib/auth/mfa-onboarding";
import { MfaEducationModal } from "./MfaEducationModal";

/**
 * Post-login / app-shell host: show MFA education once when MFA is available
 * but not yet configured. Does not change MFA APIs or challenge flow.
 */
export function EmployeeMfaOnboardingHost({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/settings/mfa")) return;
    if (hasSeenEmployeeMfaOnboarding(userId)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/mfa/status", {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { verifiedTotpCount?: number };
        if (cancelled) return;
        if ((data.verifiedTotpCount ?? 0) === 0) {
          setOpen(true);
        }
      } catch {
        // non-blocking
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, pathname]);

  if (pathname?.startsWith("/settings/mfa")) return null;

  return (
    <MfaEducationModal
      userId={userId}
      open={open}
      onClose={() => {
        markEmployeeMfaOnboardingSeen(userId);
        setOpen(false);
      }}
      onSetupNow={() => {
        markEmployeeMfaOnboardingSeen(userId);
        window.location.href = "/settings/mfa?setup=1";
      }}
    />
  );
}
