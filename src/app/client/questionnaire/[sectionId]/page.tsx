import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";
import { ClientQuestionnairePage } from "@/components/client-portal/ClientQuestionnairePage";

export default async function ClientQuestionnaireSectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  const { sectionId } = await params;
  return <ClientQuestionnairePage initialSectionId={sectionId} />;
}
