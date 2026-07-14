import Image from "next/image";
import Link from "next/link";
import { branding } from "@/config/branding";
import styles from "./Logo.module.css";

export type LogoSize = "sm" | "md" | "lg" | "sidebar" | "compact";

const LOGO_ASPECT = 297 / 210;
const LOGO_COMPACT_ASPECT = 22600 / 2620;

const LOGO_WIDTHS: Record<LogoSize, number> = {
  sm: 100,
  md: 160,
  lg: 240,
  sidebar: 200,
  compact: 260,
};

const LOGO_DIMENSIONS: Record<
  LogoSize,
  { width: number; height: number }
> = {
  sm: { width: 100, height: Math.round(100 / LOGO_ASPECT) },
  md: { width: 160, height: Math.round(160 / LOGO_ASPECT) },
  lg: { width: 240, height: Math.round(240 / LOGO_ASPECT) },
  sidebar: { width: 200, height: Math.round(200 / LOGO_ASPECT) },
  compact: { width: 260, height: Math.round(260 / LOGO_COMPACT_ASPECT) },
};

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
  const assetPath =
    size === "compact" ? branding.logoCompactPath : branding.logoPath;
  const isSvg = assetPath.toLowerCase().endsWith(".svg");

  return (
    <span
      className={[styles.frame, styles[size], className].filter(Boolean).join(" ")}
      style={
        size === "compact"
          ? undefined
          : { width: dims.width, height: dims.height }
      }
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
    size === "sidebar" ? styles.markOnlyFullWidth : "",
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
