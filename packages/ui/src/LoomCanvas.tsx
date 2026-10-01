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
      className={`relative w-full overflow-hidden select-none border border-slate-800 rounded bg-[#0A0D12] ${className}`}
      style={{
        width,
        height,
        borderColor: tokens.border,
        background: tokens.bg,
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Floating 2.5D Camera Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#111620]/90 backdrop-blur-sm px-2 py-1.5 rounded border border-[#1E2638] shadow-lg">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-7 h-7 flex items-center justify-center text-xs font-mono text-slate-300 hover:text-emerald-400 hover:bg-[#18202F] rounded border border-transparent hover:border-slate-700 transition-colors"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-7 h-7 flex items-center justify-center text-xs font-mono text-slate-300 hover:text-emerald-400 hover:bg-[#18202F] rounded border border-transparent hover:border-slate-700 transition-colors"
        >
          -
        </button>
        <div className="h-4 w-[1px] bg-[#1E2638] mx-0.5" />
        <button
          type="button"
          onClick={handleResetCamera}
          title="Reset Camera Position"
          className="px-2 h-7 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-emerald-400 hover:bg-[#18202F] rounded border border-transparent hover:border-slate-700 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Overlay Visual Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 bg-[#111620]/80 backdrop-blur-sm px-3 py-1.5 rounded border border-[#1E2638] text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-[2px] bg-cyan-400 inline-block" />
          <span>Gross Bilateral Debt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-[2.5px] bg-emerald-400 inline-block shadow-[0_0_8px_#10B981]" />
          <span>Multilateral Net Path</span>
        </div>
      </div>
    </div>
  );
};

export default LoomCanvas;
