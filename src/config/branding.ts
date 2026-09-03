export type BrandingLocale = "ru" | "en";

/** Official brand book palette */
export const brandColors = {
  black: "#000000",
  red: "#E82916",
  orange: "#F4981A",
} as const;

export const branding = {
  productName: "Spiora",
  productShortName: "Spiora",
  /** Product positioning — site, presentations, metadata */
  productDescription: {
    en: "The AI Operating System for Business",
    ru: "AI-операционная система для бизнеса",
  },
  productDescriptionShort: {
    en: "AI Operating System for Business",
    ru: "AI-операционная система для бизнеса",
  },
  /** Brand slogan — logo, splash, login (brand book) */
  brandSlogan: {
    en: "ONE PLATFORM. INFINITE SOLUTIONS.",
    ru: "ONE PLATFORM. INFINITE SOLUTIONS.",
  },
  /** Demo company shown in workspace UI (team chat, tasks, AI prompts). */
  companyName: "Spiora",
  logoPath: "/logo3.png",
  logoCompactPath: "/logo3-compact.png",
  iconPath: "/icons/icon-512x512.png",
  faviconPath: "/icons/favicon-32x32.png",
  supportEmail: "support@spiora.demo",
  websiteUrl: "https://spiora.demo",
  /** Locale-specific Spiora presentation (sidebar «Знакомство со Spiora» / Overview). */
  productPresentationUrl: {
    en: "/spiora-presentation-en.pdf",
    ru: "/spiora-presentation-ru.pdf",
  },
  demoCompanyWebsiteUrl: "https://example.com/spiora",
  defaultLocale: "en" as BrandingLocale,
  availableLocales: ["en", "ru"] as const satisfies readonly BrandingLocale[],
  demoMode:
    process.env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true" ||
    process.env.NEXT_PUBLIC_SPIORA_DEMO_MODE?.trim().toLowerCase() === "true",
  aiWorkspaceDebug:
    process.env.SPIORA_AI_WORKSPACE_DEBUG?.trim().toLowerCase() === "true",
  theme: "dark" as const,
  primaryColor: brandColors.black,
  accentColor: brandColors.red,
  brandGradientStart: brandColors.orange,
  brandGradientEnd: brandColors.red,
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

export function getBrandSlogan(
  locale: BrandingLocale = branding.defaultLocale,
): string {
  return branding.brandSlogan[locale];
}

export function getProductTagline(
  locale: BrandingLocale = branding.defaultLocale,
): string {
  return getProductDescription(locale);
}

export function getDemoCompanySiteLabel(): string {
  return `Сайт ${branding.productName}`;
}

export function getProductPresentationUrl(
  locale: BrandingLocale = branding.defaultLocale,
): string {
  return branding.productPresentationUrl[locale];
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
