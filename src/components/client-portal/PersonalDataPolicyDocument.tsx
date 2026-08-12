import type { ReactNode } from "react";
import type { AppLocale } from "@/i18n/config";
import {
  getPersonalDataPolicy,
  type PolicyBlock,
  type PolicyInline,
} from "@/lib/client-portal/personal-data-policy";
import styles from "./PersonalDataPolicyDocument.module.css";

function renderInline(parts: PolicyInline[], keyPrefix: string): ReactNode[] {
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (typeof part === "string") {
      return <span key={key}>{part}</span>;
    }
    if ("bold" in part) {
      return (
        <strong key={key} className={styles.strong}>
          {part.bold}
        </strong>
      );
    }
    return (
      <a key={key} className={styles.mail} href={part.href}>
        {part.link}
      </a>
    );
  });
}

function renderBlock(block: PolicyBlock, index: number): ReactNode {
  switch (block.type) {
    case "company":
      return (
        <header key={index} className={styles.company}>
          <p className={styles.companyName}>{block.name}</p>
          <p className={styles.companyMeta}>
            <span className={styles.metaLabel}>{block.addressLabel}:</span>{" "}
            <span className={styles.address}>
              {block.addressLines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {line}
                  {lineIndex < block.addressLines.length - 1 ? <br /> : null}
                </span>
              ))}
            </span>
          </p>
          <p className={styles.companyMeta}>
            <span className={styles.metaLabel}>{block.emailLabel}:</span>{" "}
            <a className={styles.mail} href={`mailto:${block.email}`}>
              {block.email}
            </a>
          </p>
        </header>
      );
    case "title":
      return (
        <h1 key={index} className={styles.title}>
          {block.text}
        </h1>
      );
    case "subtitle":
      return (
        <p key={index} className={styles.subtitle}>
          {block.text}
        </p>
      );
    case "meta":
      return (
        <p key={index} className={styles.version}>
          {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p key={index} className={styles.paragraph}>
          {renderInline(block.parts, `p-${index}`)}
        </p>
      );
    case "heading":
      return (
        <h2 key={index} className={styles.heading}>
          {block.text}
        </h2>
      );
    case "list":
      return (
        <ul key={index} className={styles.list}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `l-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    case "acknowledgement":
      return (
        <blockquote key={index} className={styles.acknowledgement}>
          {renderInline(block.parts, `a-${index}`)}
        </blockquote>
      );
    case "closing":
      return (
        <p key={index} className={styles.closing}>
          {block.text}
        </p>
      );
    default:
      return null;
  }
}

type PersonalDataPolicyDocumentProps = {
  locale: AppLocale;
  className?: string;
};

export function PersonalDataPolicyDocument({
  locale,
  className,
}: PersonalDataPolicyDocumentProps) {
  const blocks = getPersonalDataPolicy(locale);
  return (
    <article
      className={[styles.document, className].filter(Boolean).join(" ")}
      lang={locale === "ru" ? "ru" : "en"}
    >
      {blocks.map((block, index) => renderBlock(block, index))}
    </article>
  );
}
