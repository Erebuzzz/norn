import React, { useEffect, useRef, useState, useCallback } from "react";
import { LoomEngine, type LoomKnot, type LoomThread } from "./LoomEngine.js";
import { tokens } from "./tokens.js";
import { sound } from "./sound.js";

export * from "./LoomEngine.js";

export interface LoomCanvasProps {
  knots: LoomKnot[];
  rawThreads: LoomThread[];
  netThreads: LoomThread[];
  unweaveProgress?: number;
  onKnotSelect?: (knot: LoomKnot | null) => void;
  selectedKnot?: LoomKnot | null;
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const LoomCanvas: React.FC<LoomCanvasProps> = ({
  knots,
  rawThreads,
  netThreads,
  unweaveProgress = 0,
  onKnotSelect,
  selectedKnot,
  className = "",
  width = "100%",
  height = 540,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<LoomEngine | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = mediaQuery.matches;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(200, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateDimensions();

    const engine = new LoomEngine({
      canvas,
      knots,
      rawThreads,
      netThreads,
      unweaveProgress,
      reducedMotion,
      onKnotSelect,
    });
    engineRef.current = engine;

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setData(knots, rawThreads, netThreads);
    }
  }, [knots, rawThreads, netThreads]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setUnweaveProgress(unweaveProgress);
    }
  }, [unweaveProgress]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedKnot(selectedKnot ?? null);
    }
  }, [selectedKnot]);

  const handleZoomIn = useCallback(() => {
    if (engineRef.current) {
      const nextZoom = Math.min(3.0, zoomLevel * 1.2);
      engineRef.current.setZoom(nextZoom);
      setZoomLevel(nextZoom);
      sound.playClick(1000);
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (engineRef.current) {
      const nextZoom = Math.max(0.4, zoomLevel * 0.8);
      engineRef.current.setZoom(nextZoom);
      setZoomLevel(nextZoom);
      sound.playClick(800);
    }
  }, [zoomLevel]);

  const handleResetCamera = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetCamera();
      setZoomLevel(1.0);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width,
        height,
        borderColor: tokens.border,
        backgroundColor: tokens.bg,
        borderRadius: "4px",
        overflow: "hidden",
        userSelect: "none",
        border: `1px solid ${tokens.border}`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "grab",
          touchAction: "none",
        }}
      />

      {/* Floating 2.5D Camera Controls - Theme matched in Obsidian & Emerald */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          backgroundColor: "rgba(17, 22, 32, 0.92)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          padding: "4px 8px",
          borderRadius: "4px",
          border: `1px solid ${tokens.border}`,
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.45)",
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          style={{
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: tokens.fontFamily.mono,
            fontSize: "14px",
            fontWeight: 700,
            color: tokens.textSecondary,
            backgroundColor: tokens.panel,
            borderRadius: "3px",
            border: `1px solid ${tokens.borderSubtle}`,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = tokens.active;
            e.currentTarget.style.borderColor = tokens.active;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = tokens.textSecondary;
            e.currentTarget.style.borderColor = tokens.borderSubtle;
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: tokens.fontFamily.mono,
            fontSize: "14px",
            fontWeight: 700,
            color: tokens.textSecondary,
            backgroundColor: tokens.panel,
            borderRadius: "3px",
            border: `1px solid ${tokens.borderSubtle}`,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = tokens.active;
            e.currentTarget.style.borderColor = tokens.active;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = tokens.textSecondary;
            e.currentTarget.style.borderColor = tokens.borderSubtle;
          }}
        >
          -
        </button>
        <div style={{ width: "1px", height: "16px", backgroundColor: tokens.border, margin: "0 3px" }} />
        <button
          type="button"
          onClick={handleResetCamera}
          title="Reset Camera Position"
          style={{
            height: "28px",
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: tokens.fontFamily.mono,
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: tokens.textSecondary,
            backgroundColor: tokens.panel,
            borderRadius: "3px",
            border: `1px solid ${tokens.borderSubtle}`,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = tokens.success;
            e.currentTarget.style.borderColor = tokens.success;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = tokens.textSecondary;
            e.currentTarget.style.borderColor = tokens.borderSubtle;
          }}
        >
          Reset
        </button>
      </div>

      {/* Overlay Visual Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          backgroundColor: "rgba(17, 22, 32, 0.90)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          padding: "6px 10px",
          borderRadius: "4px",
          border: `1px solid ${tokens.border}`,
          fontFamily: tokens.fontFamily.mono,
          fontSize: "9px",
          color: tokens.textMuted,
          zIndex: 5,
          pointerEvents: "none",
          maxWidth: "fit-content",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "2px", backgroundColor: tokens.active, display: "inline-block" }} />
          <span style={{ color: tokens.textSecondary }}>Gross Debt</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "2.5px", backgroundColor: tokens.success, display: "inline-block", boxShadow: "0 0 8px #10B981" }} />
          <span style={{ color: tokens.textPrimary }}>Net Settlement</span>
        </div>
      </div>
    </div>
  );
};

export default LoomCanvas;
