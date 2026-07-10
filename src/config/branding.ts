export type BrandingLocale = "ru" | "en";

export const branding = {
  productName: "Spiora",
  productShortName: "Spiora",
  productDescription: {
    en: "Corporate Digital Workspace",
    ru: "Корпоративное цифровое пространство",
  },
  /** Fictional demo tenant — not the product name. */
  companyName: "Northstar Mobility",
  logoPath: "/spiora-logo.svg",
  iconPath: "/spiora-mark.svg",
  faviconPath: "/spiora-mark.svg",
  supportEmail: "support@spiora.demo",
  websiteUrl: "https://spiora.demo",
  demoCompanyWebsiteUrl: "https://example.com/northstar-mobility",
  defaultLocale: "ru" as BrandingLocale,
  availableLocales: ["ru", "en"] as const satisfies readonly BrandingLocale[],
  demoMode: process.env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true",
  theme: "dark" as const,
  primaryColor: "#1a202c",
  accentColor: "#910d0d",
  liveKitRoomPrefix: "spiora-cal",
  openRouterAppTitle: "Spiora",
  httpUserAgent: "spiora-demo/1.0",
} as const;

export type Branding = typeof branding;

export function getProductDescription(
  locale: BrandingLocale = branding.defaultLocale,
): string {
  return branding.productDescription[locale];
}

export function getProductTagline(
  locale: BrandingLocale = branding.defaultLocale,
): string {
  return getProductDescription(locale);
}

export function getDemoCompanySiteLabel(): string {
  return `Сайт ${branding.companyName}`;
}

export function getMeetingRoomName(eventId: string): string {
  return `${branding.liveKitRoomPrefix}-${eventId}`;
}

export function getSiteMetadata() {
  const description = `${branding.productDescription.en} — ${branding.productName}`;

  return {
    title: branding.productName,
    description,
    applicationName: branding.productName,
    openGraph: {
      title: branding.productName,
      description,
      siteName: branding.productName,
    },
  };
}

export function getManifestConfig() {
  return {
    id: "/",
    name: branding.productName,
    short_name: branding.productShortName,
    description: `${branding.productDescription.en} — ${branding.productName}`,
    start_url: "/login",
    scope: "/",
    display: "standalone" as const,
    background_color: branding.primaryColor,
    theme_color: branding.accentColor,
    orientation: "any" as const,
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any" as const,
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any" as const,
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable" as const,
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable" as const,
      },
    ],
  };
}
