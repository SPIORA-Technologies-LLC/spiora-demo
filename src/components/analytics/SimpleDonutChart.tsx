"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import styles from "./SimpleDonutChart.module.css";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  share?: number;
  color: string;
};

type SimpleDonutChartProps = {
  slices: DonutSlice[];
  size?: number;
  ariaLabel?: string;
  centerLabel?: string;
  centerValue?: string;
  emptyText?: string;
  formatValue?: (value: number) => string;
};

const DEFAULT_COLORS = [
  "#c084fc",
  "#34d399",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#fb7185",
  "#a3e635",
  "#818cf8",
  "#fbbf24",
  "#2dd4bf",
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    "M",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArc,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export function SimpleDonutChart({
  slices,
  size = 220,
  ariaLabel,
  centerLabel,
  centerValue = "100%",
  emptyText,
  formatValue = (value) => String(value),
}: SimpleDonutChartProps) {
  const t = useTranslations("analytics");

  const arcs = useMemo(() => {
    const active = slices.filter((slice) => slice.value > 0 || (slice.share ?? 0) > 0);
    const totalShare = active.reduce((sum, slice) => sum + (slice.share ?? 0), 0);
    const totalValue = active.reduce((sum, slice) => sum + slice.value, 0);
    if (active.length === 0 || (totalShare <= 0 && totalValue <= 0)) {
      return [];
    }

    let cursor = 0;
    return active.map((slice, index) => {
      const portion =
        totalShare > 0
          ? (slice.share ?? 0) / totalShare
          : totalValue > 0
            ? slice.value / totalValue
            : 0;
      const sweep = Math.max(
        portion * 360,
        slice.value > 0 || (slice.share ?? 0) > 0 ? 0.8 : 0,
      );
      const startAngle = cursor;
      const endAngle = Math.min(cursor + sweep, 359.999);
      cursor = endAngle;
      return {
        ...slice,
        color: slice.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]!,
        startAngle,
        endAngle,
        percent: Math.round(portion * 100),
      };
    });
  }, [slices]);

  if (arcs.length === 0) {
    return (
      <p className={styles.empty}>{emptyText ?? t("charts.noData")}</p>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const stroke = size * 0.14;
  const resolvedCenterLabel = centerLabel ?? t("overview.tables.share");
  const resolvedAriaLabel =
    ariaLabel ?? t("overview.charts.clientDistribution");

  return (
    <div className={styles.wrap}>
      <div className={styles.chart}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={resolvedAriaLabel}
        >
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {arcs.map((arc) => {
            if (arc.endAngle <= arc.startAngle) return null;
            const fullCircle = arc.endAngle - arc.startAngle >= 359.5;
            if (fullCircle) {
              return (
                <circle
                  key={arc.key}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                />
              );
            }
            return (
              <path
                key={arc.key}
                d={describeArc(cx, cy, radius, arc.startAngle, arc.endAngle)}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
              >
                <title>
                  {arc.label}: {arc.percent}%
                </title>
              </path>
            );
          })}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className={styles.centerLabel}
          >
            {resolvedCenterLabel}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            className={styles.centerValue}
          >
            {centerValue}
          </text>
        </svg>
      </div>

      <ul className={styles.legend}>
        {arcs.map((arc) => (
          <li key={arc.key} className={styles.legendItem}>
            <span className={styles.dot} style={{ background: arc.color }} />
            <span className={styles.legendLabel}>{arc.label}</span>
            <span className={styles.legendMeta}>
              {formatValue(arc.value)} · {arc.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
