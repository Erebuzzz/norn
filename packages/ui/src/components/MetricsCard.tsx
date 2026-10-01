import React from "react";
import { tokens } from "../tokens.js";

export interface MetricsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  status?: "normal" | "active" | "warning" | "danger";
  sparkline?: number[];
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  subValue,
  change,
  trend = "neutral",
  status = "normal",
  sparkline,
  ariaLabel,
  style,
}) => {
  let borderColor = tokens.border;
  let accentColor = tokens.textPrimary;

  if (status === "active") {
    borderColor = tokens.active;
    accentColor = tokens.active;
  } else if (status === "warning") {
    borderColor = tokens.warning;
    accentColor = tokens.warning;
  } else if (status === "danger") {
    borderColor = tokens.danger;
    accentColor = tokens.danger;
  }

  let trendColor = tokens.textMuted;
  if (trend === "up") trendColor = tokens.success;
  if (trend === "down") trendColor = tokens.danger;

  return (
    <div
      role="region"
      aria-label={ariaLabel || `${title}: ${value}`}
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: "4px",
        padding: "14px 16px",
        minWidth: "180px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: status === "active" ? tokens.glowCyan : "none",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontFamily: tokens.fontFamily.sans,
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: tokens.textSecondary,
          }}
        >
          {title}
        </span>
        {change && (
          <span
            style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: "10px",
              fontWeight: 600,
              color: trendColor,
              backgroundColor: "rgba(30, 41, 59, 0.4)",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            {change}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: accentColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>

        {/* Optional Mini SVG Sparkline */}
        {sparkline && sparkline.length > 1 && (
          <svg width="48" height="20" className="opacity-80">
            <polyline
              fill="none"
              stroke={trendColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparkline
                .map((val, idx) => {
                  const x = (idx / (sparkline.length - 1)) * 44 + 2;
                  const min = Math.min(...sparkline);
                  const max = Math.max(...sparkline);
                  const range = max - min || 1;
                  const y = 18 - ((val - min) / range) * 16;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        )}
      </div>

      {subValue && (
        <span
          style={{
            fontFamily: tokens.fontFamily.sans,
            fontSize: "11px",
            color: tokens.textMuted,
            marginTop: "6px",
          }}
        >
          {subValue}
        </span>
      )}
    </div>
  );
};

export default MetricsCard;
