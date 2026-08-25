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

const NAV_CLIENT_INVITATIONS: NavItem = {
  href: "/client-invitations",
  labelKey: "clientInvitations",
  labelNs: "nav",
  icon: "fa-solid fa-link",
};

const NAV_CLIENT_INTAKE: NavItem = {
  href: "/clients/intake",
  labelKey: "clientIntake",
  labelNs: "nav",
  icon: "fa-solid fa-inbox",
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

const NAV_CLIENT_KB: NavItem = {
  href: "/client-knowledge-base",
  labelKey: "clientKnowledgeBase",
  labelNs: "nav",
  icon: "fa-solid fa-book-open-reader",
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
  icon: "fa-solid fa-folder-open",
};

const NAV_FINANCE: NavItem = {
  href: "/finance",
  labelKey: "finance",
  labelNs: "nav",
  icon: "fa-solid fa-euro-sign",
};

const NAV_COMPANY_DETAILS: NavItem = {
  href: "/company-details",
  labelKey: "companyDetails",
  labelNs: "nav",
  icon: "fa-solid fa-building",
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
  href: branding.websiteUrl,
  labelKey: "demoCompanySite",
  labelNs: "shell",
  icon: "fa-solid fa-globe",
  external: true,
};

const MANAGER_NAV: NavItem[] = [
  NAV_DASHBOARD,
  NAV_CLIENTS,
  NAV_CLIENT_INVITATIONS,
  NAV_CLIENT_INTAKE,
  NAV_AI,
  NAV_KB,
  NAV_CLIENT_KB,
  NAV_TASKS,
  NAV_CALENDAR,
  NAV_MEETING_RECORDINGS,
  NAV_TEAM_CHAT,
  NAV_RELOCATION,
  NAV_COMPANY_DETAILS,
  NAV_TEAM,
  NAV_WEBSITE,
];

const FINANCE_MANAGER_NAV: NavItem[] = [
  NAV_DASHBOARD,
  NAV_CLIENTS,
  NAV_CLIENT_INVITATIONS,
  NAV_CLIENT_INTAKE,
  NAV_AI,
  NAV_KB,
  NAV_CLIENT_KB,
  NAV_TASKS,
  NAV_CALENDAR,
  NAV_MEETING_RECORDINGS,
  NAV_TEAM_CHAT,
  NAV_RELOCATION,
  NAV_FINANCE,
  NAV_COMPANY_DETAILS,
  NAV_TEAM,
  NAV_WEBSITE,
];

const OWNER_NAV: NavItem[] = [
  NAV_DASHBOARD,
  NAV_CLIENTS,
  NAV_CLIENT_INVITATIONS,
  NAV_CLIENT_INTAKE,
  NAV_AI,
  NAV_KB,
  NAV_CLIENT_KB,
  NAV_TASKS,
  NAV_CALENDAR,
  NAV_MEETING_RECORDINGS,
  NAV_TEAM_CHAT,
  NAV_RELOCATION,
  NAV_FINANCE,
  NAV_COMPANY_DETAILS,
  NAV_ANALYTICS,
  NAV_TEAM,
  NAV_SETTINGS,
  NAV_WEBSITE,
];

const OWNER_ONLY_PREFIXES = ["/analytics", "/settings"];
const FINANCE_PREFIX = "/finance";
const COMPANY_DETAILS_PREFIX = "/company-details";

export function getNavItemsForRole(role: UserRole): NavItem[] {
  if (role === "owner") return OWNER_NAV;
  if (role === "finance_manager") return FINANCE_MANAGER_NAV;
  return MANAGER_NAV;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }

  const isFinancePath =
    pathname === FINANCE_PREFIX || pathname.startsWith(`${FINANCE_PREFIX}/`);

  if (isFinancePath) {
    return role === "finance_manager";
  }

  if (
    OWNER_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  const baseNav =
    role === "finance_manager" ? FINANCE_MANAGER_NAV : MANAGER_NAV;
  const allowedPrefixes = baseNav
    .filter((item) => !item.external)
    .map((item) => item.href)
    .filter((href) => href !== FINANCE_PREFIX);

  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getDefaultPathForUser(_user: SessionUser): string {
  return "/dashboard";
}
