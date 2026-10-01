import React from "react";
import { tokens } from "../tokens.js";
import { sound } from "../sound.js";

export interface CrisisControlProps {
  onLiquidityShock: () => void;
  onCounterpartyFreeze: () => void;
  onObligationSpike: () => void;
  onReset: () => void;
  onRecomputeBatch?: () => void;
  isShockActive?: boolean;
  isFreezeActive?: boolean;
  isSpikeActive?: boolean;
  disabled?: boolean;
}

export const CrisisControl: React.FC<CrisisControlProps> = ({
  onLiquidityShock,
  onCounterpartyFreeze,
  onObligationSpike,
  onReset,
  onRecomputeBatch,
  isShockActive = false,
  isFreezeActive = false,
  isSpikeActive = false,
  disabled = false,
}) => {
  const handleShock = () => {
    sound.playCrisisWarning();
    onLiquidityShock();
  };

  const handleFreeze = () => {
    sound.playCrisisWarning();
    onCounterpartyFreeze();
  };

  const handleSpike = () => {
    sound.playCrisisWarning();
    onObligationSpike();
  };

  const handleReset = () => {
    sound.playReset();
    onReset();
  };

  const handleRecompute = () => {
    sound.playNettingSettlement();
    if (onRecomputeBatch) onRecomputeBatch();
  };

  return (
    <div
      role="region"
      aria-label="Crisis Injection & Stress Suite"
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: "4px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
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
          Crisis Injection & Stress Suite
        </span>
        <span
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: "10px",
            color: tokens.warning,
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            padding: "2px 6px",
            borderRadius: "2px",
          }}
        >
          SIMULATION ACTIVE
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* -40% Liquidity Shock Trigger */}
        <button
          type="button"
          onClick={handleShock}
          disabled={disabled}
          aria-pressed={isShockActive}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            backgroundColor: isShockActive ? "rgba(244, 63, 94, 0.18)" : tokens.panel,
            border: `1px solid ${isShockActive ? tokens.danger : tokens.border}`,
            borderRadius: "4px",
            color: isShockActive ? tokens.danger : tokens.textPrimary,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            boxShadow: isShockActive ? tokens.glowRose : "none",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: "12px", fontWeight: 600 }}>
              -40% Liquidity Shock
            </span>
            <span style={{ fontFamily: tokens.fontFamily.sans, fontSize: "10px", color: tokens.textMuted }}>
              Slashes node reserves; forces CONSTRAINED regime
            </span>
          </div>
          <span
            style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: isShockActive ? tokens.danger : tokens.borderSubtle,
              color: isShockActive ? "#0A0D12" : tokens.textMuted,
              fontWeight: 700,
            }}
          >
            {isShockActive ? "ON" : "OFF"}
          </span>
        </button>

        {/* Counterparty Freeze */}
        <button
          type="button"
          onClick={handleFreeze}
          disabled={disabled}
          aria-pressed={isFreezeActive}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            backgroundColor: isFreezeActive ? "rgba(245, 158, 11, 0.18)" : tokens.panel,
            border: `1px solid ${isFreezeActive ? tokens.warning : tokens.border}`,
            borderRadius: "4px",
            color: isFreezeActive ? tokens.warning : tokens.textPrimary,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: "12px", fontWeight: 600 }}>
              Freeze Counterparty (NODE-B)
            </span>
            <span style={{ fontFamily: tokens.fontFamily.sans, fontSize: "10px", color: tokens.textMuted }}>
              Simulates node distress without protocol-wide freeze
            </span>
          </div>
          <span
            style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: isFreezeActive ? tokens.warning : tokens.borderSubtle,
              color: isFreezeActive ? "#0A0D12" : tokens.textMuted,
              fontWeight: 700,
            }}
          >
            {isFreezeActive ? "FROZEN" : "CLEAR"}
          </span>
        </button>

        {/* Obligation Burst (+300%) */}
        <button
          type="button"
          onClick={handleSpike}
          disabled={disabled}
          aria-pressed={isSpikeActive}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            backgroundColor: isSpikeActive ? "rgba(6, 182, 212, 0.18)" : tokens.panel,
            border: `1px solid ${isSpikeActive ? tokens.active : tokens.border}`,
            borderRadius: "4px",
            color: isSpikeActive ? tokens.active : tokens.textPrimary,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: "12px", fontWeight: 600 }}>
              Obligation Spike (+300% Burst)
            </span>
            <span style={{ fontFamily: tokens.fontFamily.sans, fontSize: "10px", color: tokens.textMuted }}>
              Surges gross volume to test graph throughput
            </span>
          </div>
          <span
            style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: isSpikeActive ? tokens.active : tokens.borderSubtle,
              color: isSpikeActive ? "#0A0D12" : tokens.textMuted,
              fontWeight: 700,
            }}
          >
            {isSpikeActive ? "SURGING" : "NOMINAL"}
          </span>
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        {onRecomputeBatch && (
          <button
            type="button"
            onClick={handleRecompute}
            disabled={disabled}
            style={{
              flex: 1,
              backgroundColor: tokens.success,
              color: "#0A0D12",
              border: "none",
              borderRadius: "4px",
              padding: "10px 14px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: disabled ? "not-allowed" : "pointer",
              boxShadow: tokens.glowEmerald,
              transition: "transform 0.1s ease",
            }}
          >
            Recompute Batch
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          style={{
            flex: onRecomputeBatch ? "0 0 auto" : 1,
            backgroundColor: "transparent",
            color: tokens.textSecondary,
            border: `1px solid ${tokens.border}`,
            borderRadius: "4px",
            padding: "10px 14px",
            fontFamily: tokens.fontFamily.mono,
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          Reset Baseline
        </button>
      </div>
    </div>
  );
};

export default CrisisControl;
