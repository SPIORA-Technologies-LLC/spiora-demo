"use client";

import { useEffect } from "react";
import { SpioraSplashV50 } from "@/components/dashboard/SpioraSplashV50";
import { CLIENT_PORTAL_ENTRY_SPLASH_PARAM } from "@/lib/client-portal/entry-splash";

type Props = {
  onDone: () => void;
};

export function ClientPortalEntrySplash({ onDone }: Props) {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(CLIENT_PORTAL_ENTRY_SPLASH_PARAM)) return;
      url.searchParams.delete(CLIENT_PORTAL_ENTRY_SPLASH_PARAM);
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    } catch {
      // ignore
    }
  }, []);

  return <SpioraSplashV50 force onDone={onDone} />;
}
