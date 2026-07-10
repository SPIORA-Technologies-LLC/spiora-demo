import type { Metadata, Viewport } from "next";
import { PwaInstallHint } from "@/components/pwa/PwaInstallHint";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar Mobility",
  description: "Corporate Digital Workspace — Northstar Mobility Demo",
  applicationName: "Northstar Mobility",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Northstar Mobility",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1A365D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="ss-body">
        <ServiceWorkerRegister />
        <PwaInstallHint />
        {children}
      </body>
    </html>
  );
}
