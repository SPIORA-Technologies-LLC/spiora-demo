import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { CompanyDetailsView } from "@/components/company-details/CompanyDetailsView";
import { getSession } from "@/lib/auth/session";
import { canViewCompanyDetails } from "@/lib/company-details/permissions";

export default async function CompanyDetailsPage() {
  const session = await getSession();
  if (!session || !canViewCompanyDetails(session)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("companyDetails");

  return (
    <AppShell sectionTitle={t("title")}>
      <CompanyDetailsView />
    </AppShell>
  );
}
