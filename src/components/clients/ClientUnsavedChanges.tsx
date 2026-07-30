"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./ClientCrmProfile.module.css";

type LeaveHandlers = {
  save: () => Promise<boolean>;
  discard: () => void;
};

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  registerLeaveHandlers: (handlers: LeaveHandlers | null) => void;
  requestLeave: (proceed: () => void) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

export function useClientUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useClientUnsavedChanges must be used within provider");
  }
  return ctx;
}

export function useOptionalClientUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

type ProviderProps = {
  children: ReactNode;
};

export function ClientUnsavedChangesProvider({ children }: ProviderProps) {
  const t = useTranslations("clients.edit.unsaved");
  const router = useRouter();
  const [isDirty, setDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const handlersRef = useRef<LeaveHandlers | null>(null);

  const registerLeaveHandlers = useCallback((handlers: LeaveHandlers | null) => {
    handlersRef.current = handlers;
  }, []);

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      setPendingLeave(() => proceed);
    },
    [isDirty],
  );

  const closeDialog = useCallback(() => {
    setPendingLeave(null);
  }, []);

  const onDiscard = useCallback(() => {
    handlersRef.current?.discard();
    const proceed = pendingLeave;
    setPendingLeave(null);
    setDirty(false);
    proceed?.();
  }, [pendingLeave]);

  const onSaveAndLeave = useCallback(async () => {
    const save = handlersRef.current?.save;
    if (!save) return;
    setSaving(true);
    try {
      const ok = await save();
      if (!ok) return;
      const proceed = pendingLeave;
      setPendingLeave(null);
      setDirty(false);
      proceed?.();
    } finally {
      setSaving(false);
    }
  }, [pendingLeave]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash !== window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestLeave(() => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, requestLeave, router]);

  const value = useMemo(
    () => ({
      isDirty,
      setDirty,
      registerLeaveHandlers,
      requestLeave,
    }),
    [isDirty, registerLeaveHandlers, requestLeave],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pendingLeave ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.backdrop} onClick={closeDialog} />
          <div className={styles.confirmModal}>
            <h2 className={styles.confirmTitle}>{t("title")}</h2>
            <p className={styles.confirmBody}>{t("body")}</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving}
                onClick={closeDialog}
              >
                {t("stay")}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving}
                onClick={onDiscard}
              >
                {t("discard")}
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving}
                onClick={() => void onSaveAndLeave()}
              >
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}
