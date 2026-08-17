import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const signPdfAssets = [
  "./src/lib/client-portal/sign/fonts/NotoSans-Regular.ttf",
  "./src/lib/client-portal/sign/assets/spiora-logo.png",
  "./src/lib/client-portal/sign/assets/spiora-logo-compact.png",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/client/agreement/publish": signPdfAssets,
    "/api/client/agreement/sign": signPdfAssets,
    "/api/client-cases/[id]/agreement": signPdfAssets,
    "/api/client-cases/[id]/agreement/new-version": signPdfAssets,
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Service-Worker-Allowed",
          value: "/",
        },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        {
          key: "Content-Type",
          value: "application/manifest+json",
        },
      ],
    },
    {
      source: "/:path*.svg",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);
