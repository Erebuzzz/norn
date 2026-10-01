import React, { useState } from "react";
import { tokens } from "../tokens.js";
import { RegimeBadge, type RegimeType } from "./RegimeBadge.js";
import { sound } from "../sound.js";

export interface SettlementAuditRecord {
  id: string;
  epoch: number;
  timestamp: string;
  from: string;
  to: string;
  grossAmount: string;
  netAmount: string;
  obligationsCount: number;
  liquidityCheck: "PASS" | "FAIL";
  shortfallAmount?: string;
  regime: RegimeType;
  txHash: string;
  status: "SETTLED" | "REJECTED" | "RECOMPUTED";
  note?: string;
}

export interface AuditTrailProps {
  records: SettlementAuditRecord[];
  maxRows?: number;
  style?: React.CSSProperties;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({
  records,
  maxRows = 10,
  style,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const visible = records.slice(0, maxRows);

  const getStatusColor = (status: SettlementAuditRecord["status"]) => {
    switch (status) {
      case "SETTLED":
        return tokens.success;
      case "REJECTED":
        return tokens.danger;
      case "RECOMPUTED":
        return tokens.active;
      default:
        return tokens.textSecondary;
    }
  };

  const handleCopyHash = (txHash: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(txHash).catch(() => {});
      setCopiedId(id);
      sound.playClick(1400);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  return (
    <div
      role="region"
      aria-label="Settlement Audit Trail"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: "4px",
        padding: "16px",
        fontFamily: tokens.fontFamily.mono,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          paddingBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontFamily: tokens.fontFamily.sans,
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tokens.textPrimary,
            }}
          >
            EIP-712 Cryptographic Audit Feed
          </span>
          <span
            style={{
              fontSize: "10px",
              color: tokens.success,
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            STATE COMMITTED
          </span>
        </div>
        <span style={{ fontSize: "11px", color: tokens.textMuted }}>
          Showing {visible.length} of {records.length} records
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${tokens.border}`,
                color: tokens.textMuted,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th style={{ padding: "8px" }}>Epoch / Time</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Regime</th>
              <th style={{ padding: "8px" }}>Gross / Net</th>
              <th style={{ padding: "8px" }}>Obligations</th>
              <th style={{ padding: "8px" }}>Liquidity Invariant</th>
              <th style={{ padding: "8px" }}>Merkle State Root / Hash</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const statusColor = getStatusColor(r.status);
              const isCopied = copiedId === r.id;

              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                    color: tokens.textSecondary,
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <td style={{ padding: "8px", color: tokens.textPrimary }}>
                    <div>#{r.epoch}</div>
                    <div style={{ fontSize: "10px", color: tokens.textMuted }}>{r.timestamp}</div>
                  </td>
                  <td style={{ padding: "8px" }}>
                    <span
                      style={{
                        color: statusColor,
                        fontWeight: 600,
                        backgroundColor: `${statusColor}18`,
                        padding: "2px 6px",
                        borderRadius: "2px",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px" }}>
                    <RegimeBadge regime={r.regime} />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <div style={{ color: tokens.textPrimary, fontWeight: 600 }}>{r.netAmount}</div>
                    <div style={{ fontSize: "10px", color: tokens.textMuted }}>
                      from {r.grossAmount}
                    </div>
                  </td>
                  <td style={{ padding: "8px", color: tokens.textPrimary }}>
                    {r.obligationsCount} obligations
                  </td>
                  <td style={{ padding: "8px" }}>
                    <span
                      style={{
                        color: r.liquidityCheck === "PASS" ? tokens.success : tokens.danger,
                        fontWeight: 600,
                      }}
                    >
                      {r.liquidityCheck}
                    </span>
                    {r.shortfallAmount && (
                      <div style={{ fontSize: "10px", color: tokens.danger }}>
                        Deficit: {r.shortfallAmount}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(r.txHash, r.id)}
                      title="Click to copy hash"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: isCopied ? tokens.success : tokens.active,
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: tokens.fontFamily.mono,
                        fontSize: "11px",
                        textAlign: "left",
                        textDecoration: "underline",
                      }}
                    >
                      {isCopied ? "COPIED" : `${r.txHash.slice(0, 8)}...${r.txHash.slice(-6)}`}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTrail;
