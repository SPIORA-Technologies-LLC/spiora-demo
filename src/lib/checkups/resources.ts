export type CheckupResourceType = "website" | "app" | "drive";

export type CheckupResource = {
  id: string;
  type: CheckupResourceType;
  title: string;
  description: string;
  location: string;
  audience: string;
  url: string;
  icon: string;
  actionLabel: string;
};

export type CheckupSection = {
  id: string;
  title: string;
  subtitle?: string;
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
    title: "Demo checkups hub",
    subtitle: "Sample links for wellness program demonstrations",
    items: [
      {
        id: "yerevan-checkups-site",
        type: "website",
        title: "Demo checkups overview",
        description:
          "Placeholder presentation page for corporate wellness checkup programs.",
        location: "Demo city",
        audience: "For clients",
        url: YEREVAN_CHECKUPS_SITE_URL,
        icon: "fa-solid fa-book-medical",
        actionLabel: "Open demo site",
      },
      {
        id: "yerevan-checkups-docs",
        type: "drive",
        title: "Demo checkups documents",
        description:
          "Placeholder folder with sample pricing sheets and program outlines.",
        location: "Demo city",
        audience: "For team",
        url: YEREVAN_CHECKUPS_DOCS_URL,
        icon: "fa-solid fa-folder-open",
        actionLabel: "Open demo folder",
      },
      {
        id: "formula-health-app",
        type: "app",
        title: "Demo partner app",
        description:
          "Placeholder login page for a third-party wellness partner application.",
        location: "Demo city",
        audience: "Demo portal",
        url: FORMULA_HEALTH_APP_URL,
        icon: "fa-solid fa-heart-pulse",
        actionLabel: "Open demo app",
      },
    ],
  },
];
