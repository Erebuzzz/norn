import React from "react";
import { tokens } from "../tokens.js";
import type { LoomKnot, LoomThread } from "../LoomEngine.js";

export interface ObligationDrawerProps {
  knot: LoomKnot | null;
  rawThreads?: LoomThread[];
  onClose: () => void;
  style?: React.CSSProperties;
}

export const ObligationDrawer: React.FC<ObligationDrawerProps> = ({
  knot,
  rawThreads = [],
  onClose,
  style,
}) => {
  if (!knot) return null;

  const inbound = rawThreads.filter((t) => t.toId === knot.id);
  const outbound = rawThreads.filter((t) => t.fromId === knot.id);

  const totalInbound = inbound.reduce((acc, t) => acc + t.amount, 0);
  const totalOutbound = outbound.reduce((acc, t) => acc + t.amount, 0);
  const net = totalInbound - totalOutbound;

  return (
    <aside
      role="complementary"
      aria-label={`Counterparty Details for ${knot.label}`}
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: "4px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        fontFamily: tokens.fontFamily.mono,
        width: "100%",
        maxWidth: "360px",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          paddingBottom: "10px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: tokens.fontFamily.sans,
              fontSize: "14px",
              fontWeight: 700,
              color: tokens.textPrimary,
            }}
          >
            {knot.label}
          </div>
          <div style={{ fontSize: "10px", color: tokens.textMuted }}>
            Role: {knot.role} | Status: {knot.status.toUpperCase()}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            backgroundColor: "transparent",
            border: `1px solid ${tokens.border}`,
            color: tokens.textMuted,
            borderRadius: "4px",
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          fontSize: "11px",
        }}
      >
        <div
          style={{
            backgroundColor: tokens.panel,
            padding: "8px 10px",
            borderRadius: "4px",
            border: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <span style={{ color: tokens.textMuted, fontSize: "10px" }}>Cash Balance</span>
          <div style={{ fontSize: "14px", fontWeight: 700, color: tokens.textPrimary, marginTop: "2px" }}>
            ${knot.balance.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            backgroundColor: tokens.panel,
            padding: "8px 10px",
            borderRadius: "4px",
            border: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <span style={{ color: tokens.textMuted, fontSize: "10px" }}>Net Position</span>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: net >= 0 ? tokens.success : tokens.danger,
              marginTop: "2px",
            }}
          >
            {net >= 0 ? "+" : ""}${net.toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: tokens.textSecondary,
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Active Bilateral Strands</span>
          <span style={{ color: tokens.textMuted }}>
            {outbound.length} out / {inbound.length} in
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            maxHeight: "160px",
            overflowY: "auto",
            fontSize: "10px",
          }}
        >
          {outbound.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 6px",
                backgroundColor: tokens.panel,
                borderRadius: "2px",
                borderLeft: `2px solid ${tokens.danger}`,
              }}
            >
              <span>→ Owes {t.toId}</span>
              <span style={{ fontWeight: 600, color: tokens.textPrimary }}>
                ${t.amount.toLocaleString()}
              </span>
            </div>
          ))}

          {inbound.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 6px",
                backgroundColor: tokens.panel,
                borderRadius: "2px",
                borderLeft: `2px solid ${tokens.success}`,
              }}
            >
              <span>← Receives from {t.fromId}</span>
              <span style={{ fontWeight: 600, color: tokens.textPrimary }}>
                ${t.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ObligationDrawer;
