import type { Metadata, Viewport } from "next";
import { PwaInstallHint } from "@/components/pwa/PwaInstallHint";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { branding, getSiteMetadata } from "@/config/branding";
import "./globals.css";

const site = getSiteMetadata();

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
  applicationName: site.applicationName,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: branding.productName,
    statusBarStyle: "default",
  },
  openGraph: {
    title: site.openGraph.title,
    description: site.openGraph.description,
    siteName: site.openGraph.siteName,
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: branding.faviconPath, type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: branding.accentColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={branding.defaultLocale}>
      <body className="spiora-body">
        <ServiceWorkerRegister />
        <PwaInstallHint />
        {children}
      </body>
    </html>
  );
}
