import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { PwaInstallHint } from "@/components/pwa/PwaInstallHint";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { branding, getSiteMetadata } from "@/config/branding";
import { getHtmlLang } from "@/i18n/config";
import type { BrandingLocale } from "@/config/branding";
import "./globals.css";

const site = getSiteMetadata();

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as BrandingLocale;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: site.title,
    description: t("description"),
    applicationName: site.applicationName,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      title: branding.productName,
      statusBarStyle: "default",
    },
    openGraph: {
      title: site.openGraph.title,
      description: t("description"),
      siteName: site.openGraph.siteName,
      type: "website",
    },
    icons: {
      icon: [
        { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
        { url: branding.faviconPath, sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: branding.accentColor,
  viewportFit: "cover",
  // Keep focused chat/composer fields above the on-screen keyboard on mobile.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={getHtmlLang(locale as BrandingLocale)}>
      <body className="spiora-body">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ServiceWorkerRegister />
          <PwaInstallHint />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
