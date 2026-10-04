import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  tokens,
  sound,
  LoomCanvas,
  MetricsCard,
  CrisisControl,
  BaselineComparison,
  RegimeBadge,
  AuditTrail,
  SoundToggle,
  ObligationDrawer,
  type LoomKnot,
} from "@norn/ui";
import {
  createInitialArenaState,
  applyLiquidityShock,
  recomputeValidBatch,
  toggleCounterpartyFreeze,
  toggleObligationSpike,
  resetToBaseline,
  type ArenaState,
} from "./arenaSimulation.js";

export const ArenaApp: React.FC = () => {
  const [state, setState] = useState<ArenaState>(createInitialArenaState);
  const [selectedKnot, setSelectedKnot] = useState<LoomKnot | null>(null);
  const [unweaveSlider, setUnweaveSlider] = useState<number>(1.0);
  const [isAutoUnweaving, setIsAutoUnweaving] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  const handleToggleRun = useCallback(() => {
    sound.playClick(900);
    setState((prev) => ({
      ...prev,
      isRunning: !prev.isRunning,
      batchMessage: !prev.isRunning
        ? "Simulation running: Continuous obligation routing and clearing active."
        : "Simulation paused.",
    }));
  }, []);

  const handleStepEpoch = useCallback(() => {
    sound.playClick(1100);
    setState((prev) => ({
      ...prev,
      epoch: prev.epoch + 1,
      blockHeight: prev.blockHeight + 14,
      batchMessage: `Epoch #${prev.epoch + 1} stepped. Obligation pool refreshed.`,
    }));
  }, []);

  const handleLiquidityShock = useCallback(() => {
    setState((prev) => applyLiquidityShock(prev));
  }, []);

  const handleRecomputeBatch = useCallback(() => {
    setState((prev) => recomputeValidBatch(prev));
  }, []);

  const handleCounterpartyFreeze = useCallback(() => {
    setState((prev) => toggleCounterpartyFreeze(prev));
  }, []);

  const handleObligationSpike = useCallback(() => {
    setState((prev) => toggleObligationSpike(prev));
  }, []);

  const handleReset = useCallback(() => {
    setState((prev) => resetToBaseline(prev));
    setSelectedKnot(null);
    setUnweaveSlider(1.0);
  }, []);

  // Keyboard accessibility listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleToggleRun();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleStepEpoch();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleLiquidityShock();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRecomputeBatch();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleCounterpartyFreeze();
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        handleObligationSpike();
      } else if (e.key === "Escape" || e.key === "0") {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleToggleRun,
    handleStepEpoch,
    handleLiquidityShock,
    handleRecomputeBatch,
    handleCounterpartyFreeze,
    handleObligationSpike,
    handleReset,
  ]);

  // Automated loop when running
  useEffect(() => {
    if (!state.isRunning) return;
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.isShockActive && prev.batchStatus === "REJECTED") {
          return prev;
        }
        return {
          ...prev,
          epoch: prev.epoch + 1,
          blockHeight: prev.blockHeight + 12,
        };
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [state.isRunning, state.isShockActive, state.batchStatus]);

  // Auto-unweaving scrubber animation loop
  useEffect(() => {
    if (!isAutoUnweaving) return;
    const interval = setInterval(() => {
      setUnweaveSlider((prev) => {
        if (prev >= 1.0) {
          setIsAutoUnweaving(false);
          sound.playNettingSettlement();
          return 1.0;
        }
        const next = Math.min(1.0, prev + 0.05);
        sound.playUnweaveStep(next);
        return next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isAutoUnweaving]);

  const compressionPercent = useMemo(() => {
    if (state.grossFlow <= 0) return "0.0%";
    const reduction = ((state.grossFlow - state.netFlow) / state.grossFlow) * 100;
    return `${reduction.toFixed(1)}%`;
  }, [state.grossFlow, state.netFlow]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: tokens.bg,
        color: tokens.textPrimary,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: tokens.fontFamily.sans,
      }}
    >
      {/* 1. Mission Control Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          borderBottom: `1px solid ${tokens.border}`,
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <a
            href="/"
            title="Return to Protocol Landing Overview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: tokens.panel,
              border: `1px solid ${tokens.border}`,
              borderRadius: "4px",
              color: tokens.textSecondary,
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = tokens.active;
              e.currentTarget.style.borderColor = tokens.active;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = tokens.textSecondary;
              e.currentTarget.style.borderColor = tokens.border;
            }}
          >
            ← OVERVIEW
          </a>
          <a
            href="/docs"
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: `1px solid ${tokens.border}`,
              backgroundColor: tokens.bg,
              color: tokens.success,
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.success;
              e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = tokens.border;
              e.currentTarget.style.backgroundColor = tokens.bg;
            }}
          >
            DOCS ↗
          </a>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: "18px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: tokens.textPrimary,
                }}
              >
                NORN // CORE-SETTLE
              </span>
              <span
                style={{
                  fontFamily: tokens.fontFamily.mono,
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "2px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: tokens.success,
                  border: `1px solid ${tokens.success}40`,
                }}
              >
                US-EAST-01 [PROD]
              </span>
            </div>
            <div
              style={{
                fontFamily: tokens.fontFamily.mono,
                fontSize: "11px",
                color: tokens.textSecondary,
                marginTop: "2px",
              }}
            >
              Multilateral Clearing and Liquidity Layer for Autonomous Machine Payments
            </div>
          </div>
        </div>

        {/* Center Live Telemetry Stream */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            backgroundColor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: "4px",
            padding: "6px 14px",
            fontSize: "11px",
            fontFamily: tokens.fontFamily.mono,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: tokens.success,
                boxShadow: `0 0 8px ${tokens.success}`,
              }}
            />
            <span style={{ color: tokens.textMuted }}>Block:</span>
            <span style={{ color: tokens.textPrimary, fontWeight: 600 }}>
              #{state.blockHeight.toLocaleString()}
            </span>
          </div>

          <div style={{ width: "1px", height: "14px", backgroundColor: tokens.border }} />

          <div>
            <span style={{ color: tokens.textMuted }}>Epoch:</span>
            <span style={{ color: tokens.active, fontWeight: 600, marginLeft: "4px" }}>
              #{state.epoch}
            </span>
          </div>

          <div style={{ width: "1px", height: "14px", backgroundColor: tokens.border }} />

          <div>
            <span style={{ color: tokens.textMuted }}>Latency:</span>
            <span style={{ color: tokens.success, fontWeight: 600, marginLeft: "4px" }}>
              14ms
            </span>
          </div>

          <div style={{ width: "1px", height: "14px", backgroundColor: tokens.border }} />

          <RegimeBadge regime={state.regime} />
        </div>

        {/* Right Tactical Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <SoundToggle />

          <button
            type="button"
            onClick={handleToggleRun}
            style={{
              backgroundColor: state.isRunning ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${state.isRunning ? tokens.warning : tokens.success}`,
              color: state.isRunning ? tokens.warning : tokens.success,
              borderRadius: "4px",
              padding: "6px 12px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {state.isRunning ? "PAUSE FEED" : "RUN SIMULATOR"}
          </button>

          <button
            type="button"
            onClick={handleStepEpoch}
            style={{
              backgroundColor: tokens.panel,
              border: `1px solid ${tokens.border}`,
              color: tokens.textPrimary,
              borderRadius: "4px",
              padding: "6px 12px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            STEP EPOCH [S]
          </button>

          <button
            type="button"
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
            title="View Keyboard Shortcuts"
            style={{
              backgroundColor: tokens.panel,
              border: `1px solid ${tokens.border}`,
              color: tokens.textMuted,
              borderRadius: "4px",
              padding: "6px 8px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            ?
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Overlay Drawer */}
      {isShortcutsOpen && (
        <div
          style={{
            backgroundColor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: "4px",
            padding: "12px 16px",
            fontSize: "11px",
            fontFamily: tokens.fontFamily.mono,
            color: tokens.textSecondary,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <span><strong style={{ color: tokens.textPrimary }}>Space:</strong> Run / Pause</span>
            <span><strong style={{ color: tokens.textPrimary }}>S:</strong> Step Epoch</span>
            <span><strong style={{ color: tokens.textPrimary }}>L:</strong> -40% Shock</span>
            <span><strong style={{ color: tokens.textPrimary }}>R:</strong> Recompute Batch</span>
            <span><strong style={{ color: tokens.textPrimary }}>C:</strong> Freeze Counterparty</span>
            <span><strong style={{ color: tokens.textPrimary }}>O:</strong> +300% Spike</span>
            <span><strong style={{ color: tokens.textPrimary }}>Esc:</strong> Reset Baseline</span>
          </div>
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(false)}
            style={{ backgroundColor: "transparent", border: "none", color: tokens.textMuted, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Body Grid: Left Tactical Crisis Blade + Center Loom Stage */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Crisis Suite & Protocol Invariants */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <CrisisControl
            onLiquidityShock={handleLiquidityShock}
            onCounterpartyFreeze={handleCounterpartyFreeze}
            onObligationSpike={handleObligationSpike}
            onReset={handleReset}
            onRecomputeBatch={handleRecomputeBatch}
            isShockActive={state.isShockActive}
            isFreezeActive={state.isFreezeActive}
            isSpikeActive={state.isSpikeActive}
          />

          {/* Solvency & Invariants Card */}
          <div
            style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: "4px",
              padding: "14px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: tokens.textSecondary,
                marginBottom: "4px",
              }}
            >
              Protocol Solvency Invariants
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Netting Conservation:</span>
              <span style={{ color: tokens.success, fontWeight: 600 }}>SUM(net) == 0 (EXACT)</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Haircut Status:</span>
              <span style={{ color: tokens.textPrimary }}>0.0% (Zero Loss Guarantee)</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Reserve Floor:</span>
              <span style={{ color: state.isShockActive ? tokens.warning : tokens.success }}>
                {state.isShockActive ? "12.4% (CONSTRAINED)" : "25.0% (NOMINAL)"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.textMuted }}>Cycle Cancellation:</span>
              <span style={{ color: tokens.active, fontWeight: 600 }}>14 Rings Collapsed</span>
            </div>
          </div>
        </div>

        {/* Center / Right Column: The 2.5D Loom Canvas & Scrubber */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: "4px",
              padding: "10px 16px",
              fontFamily: tokens.fontFamily.mono,
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: tokens.textPrimary,
                }}
              >
                Directed Obligation Topology // Unweaving Loom
              </span>
              <span
                style={{
                  color: tokens.success,
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  padding: "2px 6px",
                  borderRadius: "2px",
                  fontWeight: 700,
                }}
              >
                {compressionPercent} OPTIMIZED
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: tokens.textMuted }}>
              <span>Click node to inspect</span>
              <span>•</span>
              <span>Scroll to zoom</span>
              <span>•</span>
              <span>Drag to pan</span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <LoomCanvas
              knots={state.knots}
              rawThreads={state.rawThreads}
              netThreads={state.netThreads}
              unweaveProgress={unweaveSlider}
              onKnotSelect={setSelectedKnot}
              selectedKnot={selectedKnot}
              height={520}
            />

            {/* Docked Obligation Drawer on Node Selection */}
            {selectedKnot && (
              <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10 }}>
                <ObligationDrawer
                  knot={selectedKnot}
                  rawThreads={state.rawThreads}
                  onClose={() => setSelectedKnot(null)}
                />
              </div>
            )}
          </div>

          {/* Quick Participant Node Inspector Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: "4px",
              padding: "8px 14px",
              fontSize: "11px",
              fontFamily: tokens.fontFamily.mono,
            }}
          >
            <span style={{ color: tokens.textMuted, fontWeight: 600 }}>PARTICIPANT NODES:</span>
            {state.knots.map((knot) => {
              const isSelected = selectedKnot?.id === knot.id;
              let dotColor = tokens.success;
              if (knot.status === "stressed") dotColor = tokens.danger;
              else if (knot.status === "constrained") dotColor = tokens.warning;
              else if (knot.status === "frozen") dotColor = "#64748B";

              return (
                <button
                  key={knot.id}
                  type="button"
                  onClick={() => {
                    setSelectedKnot(isSelected ? null : knot);
                    sound.playNodeSelect();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: isSelected ? "rgba(6, 182, 212, 0.18)" : tokens.panel,
                    border: `1px solid ${isSelected ? tokens.active : tokens.borderSubtle}`,
                    color: isSelected ? tokens.active : tokens.textPrimary,
                    padding: "4px 10px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: tokens.fontFamily.mono,
                    fontWeight: isSelected ? 700 : 500,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: dotColor }} />
                  <span>{knot.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Unweaving Timeline Scrubber */}
          <div
            style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: "4px",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                fontFamily: tokens.fontFamily.mono,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isAutoUnweaving) {
                      setIsAutoUnweaving(false);
                    } else {
                      setUnweaveSlider(0);
                      setIsAutoUnweaving(true);
                      sound.playClick(1000);
                    }
                  }}
                  style={{
                    backgroundColor: tokens.panel,
                    border: `1px solid ${tokens.border}`,
                    color: isAutoUnweaving ? tokens.warning : tokens.success,
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontFamily: tokens.fontFamily.mono,
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isAutoUnweaving ? "PAUSE UNWEAVE" : "PLAY UNWEAVE"}
                </button>
                <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>
                  UNWEAVING TIMELINE SCRUBBER
                </span>
              </div>

              <span style={{ color: tokens.active, fontWeight: 700 }}>
                {(unweaveSlider * 100).toFixed(0)}% RESOLVED
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={unweaveSlider}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setUnweaveSlider(val);
                sound.playUnweaveStep(val);
              }}
              aria-label="Unweaving progress slider"
              style={{
                width: "100%",
                accentColor: tokens.success,
                cursor: "pointer",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontFamily: tokens.fontFamily.mono,
                color: tokens.textMuted,
              }}
            >
              <span>T-00:00 Raw Gross Mesh</span>
              <span>T+00:15 Cycle Detect</span>
              <span>T+00:30 Netting Compression</span>
              <span>T+00:45 Settlement Lock</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Telemetry Deck: 4 KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <MetricsCard
          title="Gross Flow Volume"
          value={`$${(state.grossFlow / 1_000_000).toFixed(2)}M`}
          subValue={`${state.rawThreads.length} active obligations`}
          change="+18.4% 24h"
          trend="up"
          sparkline={[12, 14, 13, 16, 18, 17, 21]}
        />

        <MetricsCard
          title="Net Settlement Required"
          value={`$${(state.netFlow / 1_000_000).toFixed(2)}M`}
          subValue={`${state.netThreads.length} atomic transfers`}
          change="11.4:1 ratio"
          trend="down"
          sparkline={[8, 7, 5, 4, 3, 2, 1.8]}
        />

        <MetricsCard
          title="Liquidity Conserved"
          value={compressionPercent}
          subValue={`$${((state.grossFlow - state.netFlow) / 1_000_000).toFixed(2)}M locked capital saved`}
          change="91.27% target"
          trend="up"
          status="active"
          sparkline={[40, 55, 68, 79, 88, 91, 91.27]}
        />

        <MetricsCard
          title="Capital Velocity"
          value="8.4x / Epoch"
          subValue="142ms mean solver latency"
          change="Optimal"
          trend="neutral"
          sparkline={[6.2, 6.8, 7.4, 7.9, 8.1, 8.4, 8.4]}
        />
      </div>

      {/* 4. Baseline Settlement Comparison Matrix */}
      <BaselineComparison
        immediate={{
          transfersCount: `${state.rawThreads.length}`,
          peakLiquidity: `$${(state.grossFlow / 1_000_000).toFixed(2)}M`,
          efficiencyGain: "0.0%",
        }}
        bilateral={{
          transfersCount: `${Math.round(state.rawThreads.length * 0.45)}`,
          peakLiquidity: `$${((state.grossFlow * 0.42) / 1_000_000).toFixed(2)}M`,
          efficiencyGain: "58.0%",
        }}
        norn={{
          transfersCount: `${state.netThreads.length}`,
          peakLiquidity: `$${(state.netFlow / 1_000_000).toFixed(2)}M`,
          efficiencyGain: compressionPercent,
        }}
      />

      {/* 5. Cryptographic Audit Feed */}
      <AuditTrail records={state.auditTrail} maxRows={6} />
    </div>
  );
};

export default ArenaApp;
