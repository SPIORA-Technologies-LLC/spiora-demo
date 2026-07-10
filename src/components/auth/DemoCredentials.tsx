import { listTeamUsers } from "@/lib/auth/users";
import styles from "./DemoCredentials.module.css";

export function DemoCredentials() {
  const accounts = listTeamUsers();

  return (
    <aside className={styles.box} aria-label="Демо-доступ для разработки">
      <p className={styles.title}>Демо-учётные записи (локальная разработка)</p>
      <ul className={styles.list}>
        {accounts.map((account) => (
          <li key={account.email} className={styles.item}>
            <span className={styles.role}>
              {account.name} ({account.role})
            </span>
            <code className={styles.code}>{account.email}</code>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        Пароль задаётся в переменных AUTH_PASSWORD_* в .env.local (не хранится в
        исходном коде). Другие email не подойдут.
      </p>
    </aside>
  );
}
