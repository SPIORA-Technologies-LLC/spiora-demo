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

function formatClock(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow",
  }).format(new Date(ts));
}

function formatOnlineDuration(
  onlineMs: number,
  t: ReturnType<typeof useTranslations<"team">>,
): string {
  const totalMinutes = Math.max(0, Math.floor(onlineMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return t("minutesShort", { minutes });
  }
  return t("hoursShort", { hours, minutes });
}

export function TeamView({ user }: TeamViewProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("team");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchMembers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        members?: TeamMember[];
        canManage?: boolean;
        canDelete?: boolean;
        onlineCount?: number;
      };
      setMembers(data.members ?? []);
      setOnlineCount(data.onlineCount ?? 0);
      setCanManage(Boolean(data.canManage ?? data.canDelete));
    } catch {
      setMembers([]);
      setOnlineCount(0);
      setCanManage(false);
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

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setCreatedPassword(null);
    setCreatedName("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setToast({ text: data.error ?? t("toasts.deleteFailed") });
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

  const submitAdd = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        member?: TeamMember;
        temporaryPassword?: string;
      };
      if (!res.ok || !data.member) {
        setToast({ text: data.error ?? t("toasts.createFailed") });
        return;
      }
      setCreatedName(data.member.name);
      setCreatedPassword(addPassword);
      setToast({
        text: t("toasts.memberCreated", { name: data.member.name }),
      });
      await fetchMembers();
    } catch {
      setToast({ text: t("toasts.createFailed") });
    } finally {
      setCreating(false);
    }
  };

  const generatePassword = () => {
    const chars =
      "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let result = "";
    for (let i = 0; i < 12; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    setAddPassword(result);
  };

  const copyCreatedPassword = async () => {
    if (!createdPassword) return;
    try {
      await navigator.clipboard.writeText(createdPassword);
      setToast({ text: t("toasts.passwordCopied") });
    } catch {
      /* ignore */
    }
  };

  const headerAction = canManage ? (
    <Button
      type="button"
      onClick={() => {
        resetAddForm();
        setAddOpen(true);
      }}
    >
      {t("addManager")}
    </Button>
  ) : null;

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title={t("title")}
        subtitle={
          onlineCount > 0
            ? t("subtitleOnline", { count: onlineCount })
            : t("subtitle")
        }
        action={headerAction}
      />

      {canManage ? <p className={styles.hint}>{t("deleteHint")}</p> : null}

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
              canManage && !isSelf && member.role === "manager";
            const activity = member.activityToday;

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
                    {activity?.hasActivity ? (
                      <p className={styles.stats}>
                        {t("onlineToday")}:{" "}
                        <span className={styles.statValue}>
                          {formatOnlineDuration(activity.onlineMs, t)}
                        </span>
                        {" · "}
                        {t("workStart")}:{" "}
                        <span className={styles.statValue}>
                          {formatClock(activity.startedAt, locale)}
                        </span>
                        {" · "}
                        {t("workEnd")}:{" "}
                        <span className={styles.statValue}>
                          {formatClock(activity.endedAt, locale)}
                        </span>
                      </p>
                    ) : (
                      <p className={styles.stats}>{t("onlineNone")}</p>
                    )}
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
            <p className={styles.confirmName}>
              {translateTeamMemberName(
                locale,
                deleteTarget.id,
                deleteTarget.name,
              )}
            </p>
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

      {addOpen ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div
            className={styles.backdrop}
            onClick={() => {
              if (!creating) {
                setAddOpen(false);
                resetAddForm();
              }
            }}
            aria-hidden
          />
          <Card className={styles.modal}>
            {createdPassword ? (
              <>
                <h2 className={styles.modalTitle}>{t("addModal.createdTitle")}</h2>
                <p className={styles.confirmText}>{t("addModal.createdBody")}</p>
                <p className={styles.confirmName}>{createdName}</p>
                <p className={styles.passwordReveal}>{createdPassword}</p>
                <div className={styles.confirmActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyCreatedPassword()}
                  >
                    {t("addModal.copyPassword")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      resetAddForm();
                    }}
                  >
                    {t("addModal.done")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.modalTitle}>{t("addModal.title")}</h2>
                <p className={styles.confirmText}>{t("addModal.body")}</p>
                <label className={styles.field}>
                  <span>{t("addModal.name")}</span>
                  <input
                    className={styles.input}
                    value={addName}
                    onChange={(event) => setAddName(event.target.value)}
                    autoComplete="off"
                    disabled={creating}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("addModal.email")}</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={addEmail}
                    onChange={(event) => setAddEmail(event.target.value)}
                    autoComplete="off"
                    disabled={creating}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t("addModal.password")}</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={addPassword}
                    onChange={(event) => setAddPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={creating}
                  />
                </label>
                <div className={styles.confirmActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generatePassword}
                    disabled={creating}
                  >
                    {t("addModal.generatePassword")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAddOpen(false);
                      resetAddForm();
                    }}
                    disabled={creating}
                  >
                    {t("addModal.cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void submitAdd()}
                    disabled={creating || !addName.trim() || !addEmail.trim() || !addPassword.trim()}
                  >
                    {creating ? t("addModal.creating") : t("addModal.createBtn")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
