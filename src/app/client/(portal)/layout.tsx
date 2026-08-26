import { redirect } from "next/navigation";
import { ClientPortalSplashHost } from "@/components/client-portal/ClientPortalSplashHost";
import { ClientNotificationHost } from "@/components/client-portal/ClientNotificationHost";
import { getClientSession } from "@/lib/client-portal/session";

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
    <>
      <link
        rel="preload"
        href="/splash-v50/spiora-logo-vector.svg"
        as="image"
        type="image/svg+xml"
      />
      <link rel="preload" href="/splash-v50/spiora-brandbook.png" as="image" />
      <ClientNotificationHost />
      <ClientPortalSplashHost>{children}</ClientPortalSplashHost>
    </>
  );
}
