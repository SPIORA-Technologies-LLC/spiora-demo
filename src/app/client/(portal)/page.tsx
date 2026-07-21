import { getTranslations } from "next-intl/server";
import { ClientPortalHome } from "@/components/client-portal/ClientPortalHome";
import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";

export default async function ClientHomePage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const t = await getTranslations("clientPortal");

  return (
    <ClientPortalHome
      email={session.email}
      title={t("home.title")}
      brand={t("brand")}
      statusLabel={t("home.inviteAccepted")}
      placeholders={{
        questionnaire: t("placeholders.questionnaire"),
        documents: t("placeholders.documents"),
        status: t("placeholders.status"),
      }}
      logoutLabel={t("logout")}
    />
  );
}
