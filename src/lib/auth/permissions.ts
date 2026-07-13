import type { NavItem } from "@/components/layout/Sidebar";
import { branding } from "@/config/branding";
import type { SessionUser, UserRole } from "./types";

const NAV_DASHBOARD: NavItem = {
  href: "/dashboard",
  labelKey: "dashboard",
  labelNs: "nav",
  icon: "fa-solid fa-gauge-high",
};

const NAV_CLIENTS: NavItem = {
  href: "/clients",
  labelKey: "clients",
  labelNs: "nav",
  icon: "fa-solid fa-users",
};

const NAV_CRM_LEADS: NavItem = {
  href: "/crm/leads",
  labelKey: "crmLeads",
  labelNs: "nav",
  icon: "fa-solid fa-inbox",
};

const NAV_NEW_FORMGRID_CLIENTS: NavItem = {
  href: "/new-formgrid-clients",
  labelKey: "newFormgridClients",
  labelNs: "nav",
  icon: "fa-solid fa-user-plus",
};

const NAV_AI: NavItem = {
  href: "/ai-workspace",
  labelKey: "aiWorkspace",
  labelNs: "nav",
  icon: "fa-solid fa-wand-magic-sparkles",
};

const NAV_KB: NavItem = {
  href: "/knowledge-base",
  labelKey: "knowledgeBase",
  labelNs: "nav",
  icon: "fa-solid fa-book",
};

const NAV_TASKS: NavItem = {
  href: "/tasks",
  labelKey: "tasks",
  labelNs: "nav",
  icon: "fa-solid fa-list-check",
};

const NAV_CALENDAR: NavItem = {
  href: "/calendar",
  labelKey: "calendar",
  labelNs: "nav",
  icon: "fa-solid fa-calendar-days",
};

const NAV_TEAM_CHAT: NavItem = {
  href: "/team-chat",
  labelKey: "teamChat",
  labelNs: "nav",
  icon: "fa-solid fa-comments",
};

const NAV_MEETING_RECORDINGS: NavItem = {
  href: "/meeting-recordings",
  labelKey: "meetingRecordings",
  labelNs: "nav",
  icon: "fa-solid fa-video",
};

const NAV_RELOCATION: NavItem = {
  href: "/relocation",
  labelKey: "relocation",
  labelNs: "nav",
  icon: "fa-solid fa-plane-departure",
};

const NAV_CHECKUPS_EREVAN: NavItem = {
  href: "/checkups-erevan",
  labelKey: "checkupsErevan",
  labelNs: "nav",
  icon: "fa-solid fa-stethoscope",
};

const NAV_ANALYTICS: NavItem = {
  href: "/analytics",
  labelKey: "analytics",
  labelNs: "nav",
  icon: "fa-solid fa-chart-pie",
};

const NAV_TEAM: NavItem = {
  href: "/team",
  labelKey: "team",
  labelNs: "nav",
  icon: "fa-solid fa-people-group",
};

const NAV_SETTINGS: NavItem = {
  href: "/settings",
  labelKey: "settings",
  labelNs: "nav",
  icon: "fa-solid fa-gear",
};

const NAV_WEBSITE: NavItem = {
  href: branding.demoCompanyWebsiteUrl,
  labelKey: "demoCompanySite",
  labelNs: "shell",
  icon: "fa-solid fa-globe",
  external: true,
};

const MANAGER_NAV: NavItem[] = [
  NAV_DASHBOARD,
  NAV_CLIENTS,
  NAV_CRM_LEADS,
  NAV_NEW_FORMGRID_CLIENTS,
  NAV_AI,
  NAV_KB,
  NAV_TASKS,
  NAV_CALENDAR,
  NAV_MEETING_RECORDINGS,
  NAV_TEAM_CHAT,
  NAV_RELOCATION,
  NAV_CHECKUPS_EREVAN,
  NAV_TEAM,
  NAV_WEBSITE,
];

const OWNER_NAV: NavItem[] = [
  NAV_DASHBOARD,
  NAV_CLIENTS,
  NAV_CRM_LEADS,
  NAV_NEW_FORMGRID_CLIENTS,
  NAV_AI,
  NAV_KB,
  NAV_TASKS,
  NAV_CALENDAR,
  NAV_MEETING_RECORDINGS,
  NAV_TEAM_CHAT,
  NAV_RELOCATION,
  NAV_CHECKUPS_EREVAN,
  NAV_ANALYTICS,
  NAV_TEAM,
  NAV_SETTINGS,
  NAV_WEBSITE,
];

const OWNER_ONLY_PREFIXES = ["/analytics", "/settings"];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return role === "owner" ? OWNER_NAV : MANAGER_NAV;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }

  if (
    OWNER_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  const allowedPrefixes = MANAGER_NAV.filter((item) => !item.external).map(
    (item) => item.href,
  );
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getDefaultPathForUser(_user: SessionUser): string {
  return "/dashboard";
}
