import { ClientPortalLogin } from "@/components/client-portal/ClientPortalLogin";
import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";

export default async function ClientLoginPage() {
  const session = await getClientSession();
  if (session) redirect("/client");
  return <ClientPortalLogin />;
}
