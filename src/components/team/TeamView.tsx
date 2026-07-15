"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { OnlineIndicator } from "@/components/presence/OnlineIndicator";
import type { AppLocale } from "@/i18n/config";
import { translateRole } from "@/i18n/roles";
import { translateTeamMemberName } from "@/i18n/team-members";
import type { SessionUser } from "@/lib/auth/types";
import { PRESENCE_POLL_INTERVAL_MS } from "@/lib/presence/constants";
import type { TeamMember } from "@/lib/team/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toast, type ToastMessage } from "@/components/tasks/Toast";
import styles from "./TeamView.module.css";

type TeamViewProps = {
  user: SessionUser;
};

export function TeamView({ user }: TeamViewProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("team");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchMembers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        members?: TeamMember[];
        canDelete?: boolean;
        onlineCount?: number;
      };
      setMembers(data.members ?? []);
      setOnlineCount(data.onlineCount ?? 0);
      setCanDelete(Boolean(data.canDelete));
    } catch {
      setMembers([]);
      setOnlineCount(0);
      setCanDelete(false);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
    const interval = setInterval(() => {
      void fetchMembers({ silent: true });
    }, PRESENCE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string; demo?: boolean };
      if (!res.ok) {
        if (data.demo) {
          setToast({ text: t("demoPreviewDelete") });
        } else {
          setToast({ text: data.error ?? t("toasts.deleteFailed") });
        }
        return;
      }
      setToast({
        text: t("toasts.memberDeleted", {
          name: translateTeamMemberName(
            locale,
            deleteTarget.id,
            deleteTarget.name,
          ),
        }),
      });
      setDeleteTarget(null);
      await fetchMembers();
    } catch {
      setToast({ text: t("toasts.deleteFailed") });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title={t("title")}
        subtitle={
          onlineCount > 0
            ? t("subtitleOnline", { count: onlineCount })
            : t("subtitle")
        }
      />

      {canDelete ? (
        <p className={styles.hint}>{t("deleteHint")}</p>
      ) : null}

      {loading ? (
        <Card className={styles.empty}>{t("loading")}</Card>
      ) : members.length === 0 ? (
        <Card className={styles.empty}>{t("empty")}</Card>
      ) : (
        <ul className={styles.list}>
          {members.map((member) => {
            const isSelf = member.id === user.id;
            const memberName = translateTeamMemberName(
              locale,
              member.id,
              member.name,
            );
            const showDelete =
              canDelete &&
              !isSelf &&
              !(member.id === "olivia-bennett" && user.id !== "olivia-bennett");

            return (
              <li key={member.id}>
                <Card className={styles.row}>
                  <div className={styles.main}>
                    <p className={styles.name}>
                      <span className={styles.nameRow}>
                        {memberName}
                        <OnlineIndicator online={Boolean(member.isOnline)} />
                      </span>
                      {isSelf ? (
                        <span className={styles.you}>{t("youLabel")}</span>
                      ) : null}
                    </p>
                    <p className={styles.meta}>{member.email}</p>
                    <p className={styles.stats}>
                      {t("aiRequests")}:{" "}
                      <span className={styles.statValue}>
                        {member.aiRequestsThisMonth ?? 0}
                      </span>{" "}
                      {t("perMonth")}
                    </p>
                    <span className={styles.role}>
                      {translateRole(locale, member.role)}
                    </span>
                  </div>
                  {showDelete ? (
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteTarget(member)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {deleteTarget ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div
            className={styles.backdrop}
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden
          />
          <Card className={styles.modal}>
            <h2 className={styles.modalTitle}>{t("modal.title")}</h2>
            <p className={styles.confirmText}>{t("modal.body")}</p>
            <p className={styles.confirmName}>{deleteTarget ? translateTeamMemberName(locale, deleteTarget.id, deleteTarget.name) : ""}</p>
            <div className={styles.confirmActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t("modal.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? t("modal.deleting") : t("modal.deleteBtn")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
