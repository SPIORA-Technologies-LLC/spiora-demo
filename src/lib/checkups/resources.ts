export type CheckupResourceType = "website" | "app" | "drive";

export type CheckupResource = {
  id: string;
  type: CheckupResourceType;
  url: string;
  icon: string;
};

export type CheckupSection = {
  id: string;
  items: CheckupResource[];
};

/** Demo placeholder — public checkups overview. */
export const YEREVAN_CHECKUPS_SITE_URL =
  "https://example.com/demo/checkups/overview";

/** Demo placeholder — partner health app login. */
export const FORMULA_HEALTH_APP_URL =
  "https://example.com/demo/checkups/app";

/** Demo placeholder — shared documents folder. */
export const YEREVAN_CHECKUPS_DOCS_URL =
  "https://example.com/demo/checkups/documents";

export const CHECKUP_SECTIONS: CheckupSection[] = [
  {
    id: "yerevan",
    items: [
      {
        id: "yerevan-checkups-site",
        type: "website",
        url: YEREVAN_CHECKUPS_SITE_URL,
        icon: "fa-solid fa-book-medical",
      },
      {
        id: "yerevan-checkups-docs",
        type: "drive",
        url: YEREVAN_CHECKUPS_DOCS_URL,
        icon: "fa-solid fa-folder-open",
      },
      {
        id: "formula-health-app",
        type: "app",
        url: FORMULA_HEALTH_APP_URL,
        icon: "fa-solid fa-heart-pulse",
      },
    ],
  },
];
