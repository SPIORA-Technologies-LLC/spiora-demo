import Image from "next/image";
import Link from "next/link";
import { branding } from "@/config/branding";
import styles from "./Logo.module.css";

export type LogoSize = "sm" | "md" | "lg" | "sidebar";

const LOGO_ASPECT = 297 / 210;

const LOGO_WIDTHS: Record<LogoSize, number> = {
  sm: 100,
  md: 160,
  lg: 240,
  sidebar: 200,
};

const LOGO_DIMENSIONS: Record<
  LogoSize,
  { width: number; height: number }
> = Object.fromEntries(
  (Object.keys(LOGO_WIDTHS) as LogoSize[]).map((size) => {
    const width = LOGO_WIDTHS[size];
    return [size, { width, height: Math.round(width / LOGO_ASPECT) }];
  }),
) as Record<LogoSize, { width: number; height: number }>;

export type LogoProps = {
  showText?: boolean;
  href?: string;
  priority?: boolean;
  className?: string;
  size?: LogoSize;
};

export function LogoMark({
  priority = false,
  className,
  size = "md",
}: {
  priority?: boolean;
  className?: string;
  size?: LogoSize;
}) {
  const dims = LOGO_DIMENSIONS[size];
  const assetPath = branding.logoPath;
  const isSvg = assetPath.toLowerCase().endsWith(".svg");

  return (
    <span
      className={[styles.frame, styles[size], className].filter(Boolean).join(" ")}
      style={{ width: dims.width, height: dims.height }}
      aria-hidden={false}
    >
      {isSvg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetPath}
          alt={branding.productName}
          width={dims.width}
          height={dims.height}
          className={styles.image}
          decoding="async"
        />
      ) : (
        <Image
          src={assetPath}
          alt={branding.productName}
          width={dims.width}
          height={dims.height}
          className={styles.image}
          priority={priority}
        />
      )}
    </span>
  );
}

export function Logo({
  showText = false,
  href,
  priority = false,
  className,
  size = "md",
}: LogoProps) {
  const mark = <LogoMark priority={priority} size={size} />;

  const content = showText ? (
    <>
      {mark}
      <span className={styles.brandText}>{branding.productName}</span>
    </>
  ) : (
    mark
  );

  const rootClass = [
    showText ? styles.withText : styles.markOnly,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={rootClass}>
        {content}
      </Link>
    );
  }

  return <div className={rootClass}>{content}</div>;
}
