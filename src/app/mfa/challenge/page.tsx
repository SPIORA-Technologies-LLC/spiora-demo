import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import styles from "@/app/login/login.module.css";

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/dashboard";

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <MfaChallengeForm nextPath={nextPath} />
      </div>
    </main>
  );
}
