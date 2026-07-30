import { redirect } from "next/navigation";
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

  return <>{children}</>;
}
