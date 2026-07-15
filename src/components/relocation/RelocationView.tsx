"use client";

import { useTranslations } from "next-intl";
import { branding } from "@/config/branding";
import {
  RELOCATION_SECTIONS,
  type RelocationResource,
} from "@/lib/relocation/forms";
import { SectionHeader } from "@/components/ui/SectionHeader";
import styles from "./RelocationView.module.css";

function ResourceCard({
  resource,
  t,
}: {
  resource: RelocationResource;
  t: ReturnType<typeof useTranslations<"relocationPage">>;
}) {
  const prefix = `resources.${resource.id}` as const;

  return (
    <li className={styles.gridItem}>
      <article
        className={[
          styles.resourceCard,
          styles[`resourceCard_${resource.type}`],
        ].join(" ")}
      >
        <div className={styles.cardGlow} aria-hidden />
        <div className={styles.cardHeader}>
          <span
            className={[styles.iconWrap, styles[`icon_${resource.type}`]].join(
              " ",
            )}
            aria-hidden
          >
            <i className={resource.icon} />
          </span>
          <div className={styles.badges}>
            <span className={styles.badgeCountry}>
              {t(`${prefix}.country`)}
            </span>
            <span
              className={[
                styles.badgeAudience,
                styles[`badge_${resource.type}`],
              ].join(" ")}
            >
              {t(`${prefix}.audience`)}
            </span>
          </div>
        </div>

        <h3 className={styles.cardTitle}>{t(`${prefix}.title`)}</h3>
        <p className={styles.cardDesc}>{t(`${prefix}.description`)}</p>

        <div className={styles.actions}>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className={[
              styles.openBtn,
              styles[`openBtn_${resource.type}`],
            ].join(" ")}
            title={resource.url}
          >
            {t(`${prefix}.actionLabel`)}
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden
            />
          </a>
        </div>
      </article>
    </li>
  );
}

export function RelocationView() {
  const t = useTranslations("relocationPage");

  return (
    <div className={styles.page}>
      <SectionHeader title={t("title")} subtitle={t("headerSubtitle")} />

      {RELOCATION_SECTIONS.map((section) => (
        <section
          key={section.id}
          className={styles.section}
          aria-labelledby={`section-${section.id}`}
        >
          <div className={styles.sectionHead}>
            <h2 id={`section-${section.id}`} className={styles.sectionTitle}>
              {t(`sections.${section.id}.title`)}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t(`sections.${section.id}.subtitle`, {
                company: branding.companyName,
              })}
            </p>
          </div>
          <ul className={styles.grid}>
            {section.items.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} t={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
