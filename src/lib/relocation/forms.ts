export type RelocationResourceType =
  | "form"
  | "formgrid"
  | "app"
  | "sheets"
  | "website"
  | "telegram";

export type RelocationResource = {
  id: string;
  type: RelocationResourceType;
  title: string;
  description: string;
  country: string;
  audience: string;
  url: string;
  icon: string;
  actionLabel: string;
};

export type RelocationSection = {
  id: string;
  title: string;
  subtitle?: string;
  items: RelocationResource[];
};

/** Demo-only placeholder URLs — configure real links in a private deployment. */
export const CROATIA_DIGITAL_NOMAD_FORM_URL =
  "https://example.com/demo/relocation/intake-form";

export const EMIGRANT_CROATIA_APP_URL =
  "https://example.com/demo/relocation/desk-admin";

export const CROATIA_FORMGRID_RESULTS_URL =
  "https://example.com/demo/relocation/formgrid-results";

export const CROATIA_FORMGRID_SHEET_URL =
  "https://example.com/demo/relocation/formgrid-sheet";

export const CROATIA_FORMGRID_SHEET_ID = "DEMO_FORMGRID_SHEET_ID";

export const CROATIA_CLIENTS_SHEET_URL =
  "https://example.com/demo/relocation/clients-sheet";

export const CROATIA_CLIENTS_SHEET_ID = "DEMO_CLIENTS_SHEET_ID";

export const EMIGRANT_SK_WEBSITE_URL =
  "https://example.com/demo/relocation/website";

export const EMIGRANT_TELEGRAM_URL =
  "https://example.com/demo/relocation/telegram";

const CROATIA_RESOURCES: RelocationResource[] = [
  {
    id: "croatia-clients-sheet",
    type: "sheets",
    title: "Demo clients sheet",
    description:
      "Placeholder link for a regional client tracker spreadsheet in demo mode.",
    country: "Demo region",
    audience: "Demo data",
    url: CROATIA_CLIENTS_SHEET_URL,
    icon: "fa-solid fa-table-cells",
    actionLabel: "Open demo sheet",
  },
  {
    id: "croatia-digital-nomad-form",
    type: "form",
    title: "Demo intake form",
    description: "Sample client intake form link for demonstrations.",
    country: "Demo region",
    audience: "For clients",
    url: CROATIA_DIGITAL_NOMAD_FORM_URL,
    icon: "fa-solid fa-clipboard-list",
    actionLabel: "Open demo form",
  },
  {
    id: "croatia-formgrid-results",
    type: "formgrid",
    title: "Demo form results",
    description: "Placeholder admin view for submitted demo forms.",
    country: "Demo region",
    audience: "Admins",
    url: CROATIA_FORMGRID_RESULTS_URL,
    icon: "fa-solid fa-chart-column",
    actionLabel: "Open demo results",
  },
  {
    id: "croatia-emigrant-app",
    type: "app",
    title: "Demo desk application",
    description: "Placeholder internal case management app for demos.",
    country: "Demo region",
    audience: "For team",
    url: EMIGRANT_CROATIA_APP_URL,
    icon: "fa-solid fa-laptop",
    actionLabel: "Open demo app",
  },
  {
    id: "croatia-formgrid-sheet",
    type: "sheets",
    title: "Demo responses sheet",
    description: "Placeholder spreadsheet for demo form responses.",
    country: "Demo region",
    audience: "Form data",
    url: CROATIA_FORMGRID_SHEET_URL,
    icon: "fa-solid fa-table",
    actionLabel: "Open demo sheet",
  },
];

const EMIGRANT_EU_RESOURCES: RelocationResource[] = [
  {
    id: "emigrant-sk-website",
    type: "website",
    title: "Demo public website",
    description: "Placeholder marketing site for relocation programs.",
    country: "Europe",
    audience: "Public",
    url: EMIGRANT_SK_WEBSITE_URL,
    icon: "fa-solid fa-globe",
    actionLabel: "Open demo site",
  },
  {
    id: "emigrant-telegram",
    type: "telegram",
    title: "Demo Telegram channel",
    description: "Placeholder social channel link for demonstrations.",
    country: "Europe",
    audience: "Demo channel",
    url: EMIGRANT_TELEGRAM_URL,
    icon: "fa-brands fa-telegram",
    actionLabel: "Open demo link",
  },
];

export const RELOCATION_SECTIONS: RelocationSection[] = [
  {
    id: "croatia",
    title: "Demo relocation hub",
    subtitle: "Sample resources for Northstar Mobility demonstrations",
    items: CROATIA_RESOURCES,
  },
  {
    id: "emigrant-eu",
    title: "Demo external links",
    subtitle: "Placeholder website and channel links",
    items: EMIGRANT_EU_RESOURCES,
  },
];

export const RELOCATION_RESOURCES: RelocationResource[] =
  RELOCATION_SECTIONS.flatMap((section) => section.items);

/** @deprecated используйте RELOCATION_RESOURCES */
export const RELOCATION_FORMS = RELOCATION_RESOURCES;
