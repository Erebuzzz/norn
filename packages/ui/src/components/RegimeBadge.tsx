import React from "react";
import { tokens, type RegimeType } from "../tokens.js";

export { type RegimeType };

export interface RegimeBadgeProps {
  regime: RegimeType;
  showDescription?: boolean;
  style?: React.CSSProperties;
}

export const RegimeBadge: React.FC<RegimeBadgeProps> = ({
  regime,
  showDescription = false,
  style,
}) => {
  const meta = tokens.regimes[regime] || tokens.regimes.NORMAL;

  return (
    <div
      role="status"
      aria-label={`Current Protocol Risk Regime: ${meta.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "4px",
        padding: "4px 10px",
        fontFamily: tokens.fontFamily.mono,
        fontSize: "11px",
        fontWeight: 600,
        color: meta.color,
        letterSpacing: "0.08em",
        boxShadow: meta.glow,
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "flex",
          width: "6px",
          height: "6px",
        }}
      >
        <span
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundColor: meta.color,
            opacity: 0.75,
          }}
        />
        <span
          style={{
            position: "relative",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: meta.color,
            boxShadow: `0 0 8px ${meta.color}`,
          }}
        />
      </span>
      <span>{meta.label}</span>
      {showDescription && (
        <span
          style={{
            fontSize: "10px",
            color: tokens.textSecondary,
            fontWeight: 400,
            marginLeft: "4px",
          }}
        >
          {meta.description}
        </span>
      )}
    </div>
  );
};

export default RegimeBadge;
