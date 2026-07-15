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
  url: string;
  icon: string;
};

export type RelocationSection = {
  id: string;
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
    url: CROATIA_CLIENTS_SHEET_URL,
    icon: "fa-solid fa-table-cells",
  },
  {
    id: "croatia-digital-nomad-form",
    type: "form",
    url: CROATIA_DIGITAL_NOMAD_FORM_URL,
    icon: "fa-solid fa-clipboard-list",
  },
  {
    id: "croatia-formgrid-results",
    type: "formgrid",
    url: CROATIA_FORMGRID_RESULTS_URL,
    icon: "fa-solid fa-chart-column",
  },
  {
    id: "croatia-emigrant-app",
    type: "app",
    url: EMIGRANT_CROATIA_APP_URL,
    icon: "fa-solid fa-laptop",
  },
  {
    id: "croatia-formgrid-sheet",
    type: "sheets",
    url: CROATIA_FORMGRID_SHEET_URL,
    icon: "fa-solid fa-table",
  },
];

const EMIGRANT_EU_RESOURCES: RelocationResource[] = [
  {
    id: "emigrant-sk-website",
    type: "website",
    url: EMIGRANT_SK_WEBSITE_URL,
    icon: "fa-solid fa-globe",
  },
  {
    id: "emigrant-telegram",
    type: "telegram",
    url: EMIGRANT_TELEGRAM_URL,
    icon: "fa-brands fa-telegram",
  },
];

export const RELOCATION_SECTIONS: RelocationSection[] = [
  {
    id: "croatia",
    items: CROATIA_RESOURCES,
  },
  {
    id: "emigrant-eu",
    items: EMIGRANT_EU_RESOURCES,
  },
];

export const RELOCATION_RESOURCES: RelocationResource[] =
  RELOCATION_SECTIONS.flatMap((section) => section.items);

/** @deprecated используйте RELOCATION_RESOURCES */
export const RELOCATION_FORMS = RELOCATION_RESOURCES;
