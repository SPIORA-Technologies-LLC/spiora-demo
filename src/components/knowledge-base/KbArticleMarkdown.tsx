import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./KnowledgeBaseView.module.css";

type KbArticleMarkdownProps = {
  content: string;
};

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  const lower = href.trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return false;
  }
  if (lower.startsWith("/") || lower.startsWith("#")) return true;
  return lower.startsWith("http://") || lower.startsWith("https://");
}

export function KbArticleMarkdown({ content }: KbArticleMarkdownProps) {
  return (
    <div className={styles.articleMarkdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            isSafeHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
