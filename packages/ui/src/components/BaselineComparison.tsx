import React from "react";
import { tokens } from "../tokens.js";

export interface BaselineMetric {
  name: string;
  transfersCount: string | number;
  peakLiquidity: string;
  efficiencyGain: string;
  resilienceRating: string;
  deadlockRisk: string;
  isNorn?: boolean;
}

export interface BaselineComparisonProps {
  immediate?: Partial<BaselineMetric>;
  bilateral?: Partial<BaselineMetric>;
  norn?: Partial<BaselineMetric>;
  style?: React.CSSProperties;
}

export const BaselineComparison: React.FC<BaselineComparisonProps> = ({
  immediate,
  bilateral,
  norn,
  style,
}) => {
  const cards: BaselineMetric[] = [
    {
      name: "Gross Settlement",
      transfersCount: immediate?.transfersCount ?? "10,000",
      peakLiquidity: immediate?.peakLiquidity ?? "$14,892,400",
      efficiencyGain: immediate?.efficiencyGain ?? "0.0%",
      resilienceRating: immediate?.resilienceRating ?? "Fragile",
      deadlockRisk: immediate?.deadlockRisk ?? "High (Cascading default)",
      isNorn: false,
    },
    {
      name: "Bilateral Netting",
      transfersCount: bilateral?.transfersCount ?? "3,480",
      peakLiquidity: bilateral?.peakLiquidity ?? "$6,120,000",
      efficiencyGain: bilateral?.efficiencyGain ?? "58.9%",
      resilienceRating: bilateral?.resilienceRating ?? "Moderate",
      deadlockRisk: bilateral?.deadlockRisk ?? "Medium (Pairwise only)",
      isNorn: false,
    },
    {
      name: "NORN Multilateral",
      transfersCount: norn?.transfersCount ?? "873",
      peakLiquidity: norn?.peakLiquidity ?? "$1,300,510",
      efficiencyGain: norn?.efficiencyGain ?? "91.27%",
      resilienceRating: norn?.resilienceRating ?? "Autonomous Resilient",
      deadlockRisk: norn?.deadlockRisk ?? "Zero (Cycle Netting)",
      isNorn: true,
    },
  ];

  return (
    <div
      role="region"
      aria-label="Settlement Comparison Matrix"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "12px",
        ...style,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.name}
          style={{
            backgroundColor: c.isNorn ? "rgba(16, 185, 129, 0.05)" : tokens.surface,
            border: `1px solid ${c.isNorn ? tokens.success : tokens.border}`,
            borderRadius: "4px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: c.isNorn ? tokens.glowEmerald : "none",
            position: "relative",
          }}
        >
          {c.isNorn && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "12px",
                backgroundColor: tokens.success,
                color: "#0A0D12",
                fontFamily: tokens.fontFamily.mono,
                fontSize: "9px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "2px",
                letterSpacing: "0.06em",
              }}
            >
              NORN ENGINE
            </div>
          )}

          <div>
            <span
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: "13px",
                fontWeight: 600,
                color: c.isNorn ? tokens.success : tokens.textPrimary,
              }}
            >
              {c.name}
            </span>
            <div
              style={{
                fontFamily: tokens.fontFamily.mono,
                fontSize: "22px",
                fontWeight: 700,
                color: c.isNorn ? tokens.success : tokens.textPrimary,
                marginTop: "4px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {c.efficiencyGain}
            </div>
            <span
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: "10px",
                color: tokens.textMuted,
              }}
            >
              Capital Conservation
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              borderTop: `1px solid ${tokens.borderSubtle}`,
              paddingTop: "10px",
              fontSize: "11px",
              fontFamily: tokens.fontFamily.mono,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Settlement Transfers:</span>
              <span style={{ color: tokens.textSecondary }}>{c.transfersCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Peak Liquidity Locked:</span>
              <span style={{ color: tokens.textSecondary }}>{c.peakLiquidity}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Deadlock Vulnerability:</span>
              <span style={{ color: c.isNorn ? tokens.success : tokens.textMuted }}>
                {c.deadlockRisk}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BaselineComparison;
