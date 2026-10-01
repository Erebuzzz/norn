import { LoomHeroCanvas } from "./LoomHeroCanvas.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("loom-canvas") as HTMLCanvasElement | null;
  const slider = document.getElementById("hero-unweave-slider") as HTMLInputElement | null;
  const label = document.getElementById("hero-progress-label");

  let heroCanvas: LoomHeroCanvas | null = null;

  if (canvas) {
    heroCanvas = new LoomHeroCanvas(canvas);
  }

  if (slider && heroCanvas) {
    slider.addEventListener("input", (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      heroCanvas?.setUnweaveProgress(val);
      if (label) {
        if (val >= 0.95) {
          label.textContent = "100% NETTED";
          label.style.color = "var(--emerald)";
        } else if (val <= 0.05) {
          label.textContent = "RAW GROSS MESH";
          label.style.color = "var(--cyan)";
        } else {
          label.textContent = `${(val * 100).toFixed(0)}% RESOLVED`;
          label.style.color = "var(--sky)";
        }
      }
    });
  }

  // Smooth scroll for internal navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (href && href !== "#") {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });

  // Attempt live telemetry polling from API server if running
  const fetchLiveState = async () => {
    try {
      const res = await fetch("http://localhost:4000/network/state");
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.metrics) {
        const grossEl = document.querySelector("#telemetry .telemetry-cell:nth-child(1) .telemetry-value");
        const netEl = document.querySelector("#telemetry .telemetry-cell:nth-child(2) .telemetry-value");
        const conservedEl = document.querySelector("#telemetry .telemetry-cell:nth-child(3) .telemetry-value");

        if (grossEl && data.metrics.grossFlowVolume) {
          grossEl.textContent = `$${(data.metrics.grossFlowVolume / 1_000_000).toFixed(2)}M`;
        }
        if (netEl && data.metrics.netSettlementVolume) {
          netEl.textContent = `$${(data.metrics.netSettlementVolume / 1_000_000).toFixed(2)}M`;
        }
        if (conservedEl && data.metrics.capitalConservedPercent) {
          conservedEl.textContent = `${data.metrics.capitalConservedPercent}%`;
        }
      }
    } catch {
      // Graceful fallback to static telemetry baseline
    }
  };

  fetchLiveState();
});
