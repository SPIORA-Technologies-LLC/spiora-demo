import { ClientMfaChallengeForm } from "@/components/client-portal/ClientMfaChallengeForm";
import styles from "@/app/login/login.module.css";

export default async function ClientMfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/client";

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <ClientMfaChallengeForm nextPath={nextPath} />
      </div>
    </main>
  );
}
