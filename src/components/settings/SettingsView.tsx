"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import type { AppLocale } from "@/i18n/config";
import { translateRole } from "@/i18n/roles";
import { translateTeamMemberName } from "@/i18n/team-members";
import { branding } from "@/config/branding";
import type { SessionUser } from "@/lib/auth/types";
import type {
  IntegrationKey,
  IntegrationStatuses,
} from "@/lib/settings/integrations";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast, type ToastMessage } from "@/components/tasks/Toast";
import styles from "./SettingsView.module.css";

type SettingsTab =
  | "profile"
  | "company"
  | "notifications"
  | "security"
  | "appearance"
  | "language"
  | "integrations"
  | "ai"
  | "calendar";

type PasswordMember = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager";
  deleted: boolean;
  hasCustomPassword: boolean;
  passwordUpdatedAt: string | null;
  passwordUpdatedBy: string | null;
};

type ResetResult = {
  userName: string;
  email: string;
  password: string;
};

type SettingsViewProps = {
  user: SessionUser;
  demoMode: boolean;
  integrationStatuses: IntegrationStatuses;
  companyWebsite: string;
};

const TAB_ORDER: SettingsTab[] = [
  "profile",
  "company",
  "notifications",
  "security",
  "appearance",
  "language",
  "integrations",
  "ai",
  "calendar",
];

const INTEGRATION_KEYS: IntegrationKey[] = [
  "googleDrive",
  "googleSheets",
  "supabase",
  "livekit",
  "webhooks",
  "externalAi",
];

function formatDate(value: string | null, locale: AppLocale): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        type="text"
        className={styles.input}
        value={value}
        readOnly
        disabled
      />
    </label>
  );
}

export function SettingsView({
  user,
  demoMode,
  integrationStatuses,
  companyWebsite,
}: SettingsViewProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings");
  const tDemo = useTranslations("demoGuard");
  const tLang = useTranslations("language");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [mobileShowPanel, setMobileShowPanel] = useState(false);
  const [members, setMembers] = useState<PasswordMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<PasswordMember | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/passwords");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { members?: PasswordMember[] };
      setMembers(data.members ?? []);
    } catch {
      setMembers([]);
      setToast({
        text: t("security.password.toasts.loadFailed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  function openReset(member: PasswordMember) {
    if (demoMode) {
      setToast({ text: tDemo("settingsPasswordReset"), type: "error" });
      return;
    }
    setResetTarget(member);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setResetResult(null);
  }

  function closeReset() {
    setResetTarget(null);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setResetResult(null);
  }

  async function submitReset(generate = false) {
    if (!resetTarget || demoMode) return;

    if (!generate && password !== confirmPassword) {
      setError(t("security.password.errors.passwordsMismatch"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetTarget.id,
          password: generate ? undefined : password,
          generate,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        demo?: boolean;
        password?: string;
        userName?: string;
        email?: string;
      };
      if (!res.ok) {
        if (data.demo) {
          setError(tDemo("settingsPasswordReset"));
        } else {
          setError(data.error ?? t("security.password.errors.resetFailed"));
        }
        return;
      }

      setResetResult({
        userName: data.userName ?? resetTarget.name,
        email: data.email ?? resetTarget.email,
        password: data.password ?? "",
      });
      await fetchMembers();
    } catch {
      setError(t("security.password.errors.resetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!resetResult?.password) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setToast({ text: t("security.password.toasts.passwordCopied") });
    } catch {
      setToast({
        text: t("security.password.toasts.copyFailed"),
        type: "error",
      });
    }
  }

  function renderDemoNotice() {
    if (!demoMode) return null;
    return <p className={styles.demoNotice}>{t("demoContent.readOnlyNotice")}</p>;
  }

  function renderProfileTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.profile.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.profile.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.profile.name")}
          value={translateTeamMemberName(locale, user.id, user.name)}
        />
        <ReadOnlyField
          label={t("demoContent.profile.email")}
          value={user.email}
        />
        <ReadOnlyField
          label={t("demoContent.profile.role")}
          value={translateRole(locale, user.role)}
        />
      </Card>
    );
  }

  function renderCompanyTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.company.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.company.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.company.name")}
          value={branding.companyName}
        />
        <ReadOnlyField
          label={t("demoContent.company.timezone")}
          value={t("demoContent.values.timezone")}
        />
        <ReadOnlyField
          label={t("demoContent.company.website")}
          value={companyWebsite}
        />
      </Card>
    );
  }

  function renderNotificationsTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.notifications.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.notifications.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.notifications.emailDigest")}
          value={t("demoContent.values.emailDigest")}
        />
        <ReadOnlyField
          label={t("demoContent.notifications.inApp")}
          value={t("demoContent.values.inApp")}
        />
        <ReadOnlyField
          label={t("demoContent.notifications.taskAlerts")}
          value={t("demoContent.values.taskAlerts")}
        />
      </Card>
    );
  }

  function renderAppearanceTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.appearance.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.appearance.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.appearance.theme")}
          value={t("demoContent.values.theme")}
        />
        <ReadOnlyField
          label={t("demoContent.appearance.density")}
          value={t("demoContent.values.density")}
        />
      </Card>
    );
  }

  function renderLanguageTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.language.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.language.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.language.locale")}
          value={tLang(locale)}
        />
        <div className={styles.languageSwitcherWrap}>
          <LanguageSwitcher />
        </div>
      </Card>
    );
  }

  function renderAiTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.ai.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.ai.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.ai.model")}
          value={t("demoContent.values.model")}
        />
        <ReadOnlyField
          label={t("demoContent.ai.context")}
          value={t("demoContent.values.context")}
        />
      </Card>
    );
  }

  function renderCalendarTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.calendar.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.calendar.hint")}</p>
        {renderDemoNotice()}
        <ReadOnlyField
          label={t("demoContent.calendar.defaultDuration")}
          value={t("demoContent.values.defaultDuration")}
        />
        <ReadOnlyField
          label={t("demoContent.calendar.videoProvider")}
          value={t("demoContent.values.videoProvider")}
        />
      </Card>
    );
  }

  function renderIntegrationsTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("tabs.integrations.title")}</h2>
        <p className={styles.sectionHint}>{t("tabs.integrations.hint")}</p>
        {renderDemoNotice()}
        <ul className={styles.integrationList}>
          {INTEGRATION_KEYS.map((key) => (
            <li key={key} className={styles.integrationRow}>
              <div className={styles.integrationMain}>
                <span className={styles.integrationName}>
                  {t(`integrations.${key}`)}
                </span>
                <span className={styles.integrationDescription}>
                  {t(`integrations.descriptions.${key}`)}
                </span>
              </div>
              <span className={styles.integrationStatus}>
                {t(
                  `integrations.statuses.${integrationStatuses[key]}`,
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  function renderSecurityTab() {
    return (
      <Card className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>
          {t("security.password.title")}
        </h2>
        <p className={styles.sectionHint}>{t("security.password.hint")}</p>
        <div className={styles.securityActions}>
          <a href="/settings/mfa" className={styles.securityAction}>
            {t("security.mfaLink")}
          </a>
          <a href="/settings/password" className={styles.securityAction}>
            {t("security.selfPasswordLink")}
          </a>
        </div>
        {demoMode ? (
          <p className={styles.demoGuardHint}>
            {tDemo("settingsPasswordReset")}
          </p>
        ) : null}

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("security.password.table.employee")}</th>
                <th>{t("security.password.table.role")}</th>
                <th>{t("security.password.table.passwordStatus")}</th>
                <th>{t("security.password.table.updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>{t("security.password.loading")}</td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className={styles.memberName}>
                        {translateTeamMemberName(
                          locale,
                          member.id,
                          member.name,
                        )}
                      </span>
                      <div className={styles.memberEmail}>{member.email}</div>
                    </td>
                    <td>{translateRole(locale, member.role)}</td>
                    <td>
                      {member.deleted ? (
                        <span className={`${styles.badge} ${styles.badgeMuted}`}>
                          {t("security.password.badges.accessDisabled")}
                        </span>
                      ) : member.hasCustomPassword ? (
                        <span className={`${styles.badge} ${styles.badgeOk}`}>
                          {t("security.password.badges.resetManually")}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeMuted}`}>
                          {t("security.password.badges.fromHosting")}
                        </span>
                      )}
                    </td>
                    <td className={styles.metaMuted}>
                      {member.hasCustomPassword ? (
                        <>
                          {formatDate(member.passwordUpdatedAt, locale)}
                          {member.passwordUpdatedBy
                            ? ` · ${member.passwordUpdatedBy}`
                            : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={member.deleted || demoMode}
                        onClick={() => openReset(member)}
                      >
                        {t("security.password.resetPassword")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "profile":
        return renderProfileTab();
      case "company":
        return renderCompanyTab();
      case "notifications":
        return renderNotificationsTab();
      case "security":
        return renderSecurityTab();
      case "appearance":
        return renderAppearanceTab();
      case "language":
        return renderLanguageTab();
      case "integrations":
        return renderIntegrationsTab();
      case "ai":
        return renderAiTab();
      case "calendar":
        return renderCalendarTab();
      default:
        return null;
    }
  }

  return (
    <div className={styles.settingsWrap}>
      {demoMode ? (
        <span className={styles.demoBadge}>{t("demoBadge")}</span>
      ) : null}

      <div
        className={styles.layout}
        data-mobile-view={mobileShowPanel ? "detail" : "list"}
      >
        <nav className={styles.tabNav} aria-label={t("title")}>
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              className={
                activeTab === tab ? styles.tabActive : styles.tab
              }
              onClick={() => {
                setActiveTab(tab);
                setMobileShowPanel(true);
              }}
            >
              <span className={styles.tabTitle}>{t(`tabs.${tab}.title`)}</span>
              <span className={styles.tabHint}>{t(`tabs.${tab}.hint`)}</span>
            </button>
          ))}
        </nav>

        <div className={styles.tabPanel}>
          <button
            type="button"
            className={styles.mobileBack}
            onClick={() => setMobileShowPanel(false)}
          >
            ← {t("backToList")}
          </button>
          {renderTabContent()}
        </div>
      </div>

      {resetTarget ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.backdrop} onClick={closeReset} aria-hidden />
          <Card className={styles.modal}>
            {resetResult ? (
              <>
                <h3 className={styles.modalTitle}>
                  {t("security.password.modal.successTitle")}
                </h3>
                <p className={styles.modalText}>
                  {t("security.password.modal.successBody", {
                    name: resetResult.userName,
                    email: resetResult.email,
                  })}
                </p>
                <div className={styles.passwordReveal}>
                  <span>{t("security.password.modal.newPasswordLabel")}</span>
                  <code className={styles.passwordValue}>
                    {resetResult.password}
                  </code>
                </div>
                <p className={styles.warning}>
                  {t("security.password.modal.warning")}
                </p>
                <div className={styles.modalActions}>
                  <Button type="button" variant="secondary" onClick={closeReset}>
                    {t("security.password.modal.close")}
                  </Button>
                  <Button type="button" onClick={() => void copyPassword()}>
                    {t("security.password.modal.copy")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>
                  {t("security.password.modal.resetTitle", {
                    name: translateTeamMemberName(
                      locale,
                      resetTarget.id,
                      resetTarget.name,
                    ),
                  })}
                </h3>
                <p className={styles.modalText}>
                  {t("security.password.modal.resetBody")}
                </p>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("security.password.modal.newPasswordLabel")}
                  </span>
                  <input
                    type="text"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("security.password.modal.repeatPasswordLabel")}
                  </span>
                  <input
                    type="text"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={submitting}
                  />
                </label>
                <div className={styles.modalActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={closeReset}
                  >
                    {t("security.password.modal.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => void submitReset(true)}
                  >
                    {t("security.password.modal.generate")}
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting || !password || !confirmPassword}
                    onClick={() => void submitReset(false)}
                  >
                    {submitting
                      ? t("security.password.modal.saving")
                      : t("security.password.modal.save")}
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
