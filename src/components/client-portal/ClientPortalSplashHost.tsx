"use client";

import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClientPortalEntrySplash } from "./ClientPortalEntrySplash";

function isClientHomePath(pathname: string) {
  return pathname === "/client" || pathname === "/client/";
}

type Props = {
  children: ReactNode;
};

export function ClientPortalSplashHost({ children }: Props) {
  const pathname = usePathname();
  const isHome = isClientHomePath(pathname);
  const [playing, setPlaying] = useState(isHome);
  const onDone = useCallback(() => setPlaying(false), []);

  useLayoutEffect(() => {
    setPlaying(isHome);
  }, [isHome]);

  return (
    <>
      {playing ? <ClientPortalEntrySplash onDone={onDone} /> : null}
      {children}
    </>
  );
}
