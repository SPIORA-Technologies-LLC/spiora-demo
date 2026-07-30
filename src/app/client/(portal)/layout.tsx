import { Cormorant_Garamond, Manrope } from "next/font/google";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-portal/session";

const portalDisplay = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--portal-font-display",
  display: "swap",
});

const portalSans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--portal-font-sans",
  display: "swap",
});

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientSession();
  if (!session) {
    redirect("/client/login");
  }

  return (
    <div className={`${portalDisplay.variable} ${portalSans.variable}`}>
      {children}
    </div>
  );
}
