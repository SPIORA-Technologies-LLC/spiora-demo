import { getClientSession } from "@/lib/client-portal/session";
import { redirect } from "next/navigation";
import { ClientQuestionnairePage } from "@/components/client-portal/ClientQuestionnairePage";

export default async function ClientQuestionnaireReviewPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  return <ClientQuestionnairePage reviewMode />;
}
