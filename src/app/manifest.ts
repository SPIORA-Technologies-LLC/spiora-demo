import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { branding } from "@/config/branding";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    id: "/",
    name: branding.productName,
    short_name: branding.productShortName,
    description: t("description"),
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: branding.primaryColor,
    theme_color: branding.accentColor,
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
