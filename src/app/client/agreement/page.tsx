import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import { ClientConsultingAgreementPage } from "@/components/client-portal/ClientConsultingAgreementPage";

export async function generateMetadata() {
  const locale = (await getLocale()) as AppLocale;
  return {
    title:
      locale === "ru"
        ? "Договор о консультационных услугах"
        : "Consulting services agreement",
  };
}

export default async function ClientAgreementPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  return <ClientConsultingAgreementPage />;
}
