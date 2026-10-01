export const bg = "#07090B";
export const surface = "#0C0F12";
export const panel = "#151A1F";
export const border = "#283038";
export const textPrimary = "#E7E4DB";
export const textSecondary = "#A5A9AE";
export const textMuted = "#6F747B";
export const active = "#9ED8E8";
export const success = "#8FB8A4";
export const danger = "#D7664F";

export const warning = "#F59E0B";
export const borderSubtle = "#161D2B";
export const borderFocus = "#06B6D4";
export const borderActive = "#334155";

// Stitch Obsidian Infrastructure Terminal Extensions
export const obsidian = "#0A0D12";
export const surfaceVoid = "#111620";
export const telemetryNavy = "#18202F";
export const surfaceElevated = "#1E293B";
export const laserEmerald = "#10B981";
export const coldCyan = "#06B6D4";
export const diagnosticSky = "#38BDF8";
export const alertRose = "#F43F5E";
export const textTitanium = "#F8FAFC";

export const glowEmerald = "0 0 12px rgba(16, 185, 129, 0.25)";
export const glowCyan = "0 0 12px rgba(6, 182, 212, 0.30)";
export const glowRose = "0 0 12px rgba(244, 63, 94, 0.35)";

export const TOKENS = {
  bg,
  surface,
  panel,
  border,
  textPrimary,
  textSecondary,
  textMuted,
  active,
  success,
  danger,
  warning,
  borderSubtle,
  borderFocus,
  borderActive,

  obsidian,
  surfaceVoid,
  telemetryNavy,
  surfaceElevated,
  laserEmerald,
  coldCyan,
  diagnosticSky,
  alertRose,
  textTitanium,

  glowEmerald,
  glowCyan,
  glowRose,

  fontFamily: {
    sans: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
    display: "'Space Grotesk', -apple-system, sans-serif",
  },
  regimes: {
    NORMAL: {
      label: "NORMAL",
      color: success,
      bg: "rgba(143, 184, 164, 0.12)",
      border: success,
      glow: glowEmerald,
      description: "Standard multilateral clearing with full capacity",
    },
    CONSTRAINED: {
      label: "CONSTRAINED",
      color: warning,
      bg: "rgba(245, 158, 11, 0.14)",
      border: warning,
      glow: "0 0 12px rgba(245, 158, 11, 0.25)",
      description: "Liquidity reserve under pressure, priority queuing active",
    },
    DEFENSIVE: {
      label: "DEFENSIVE",
      color: danger,
      bg: "rgba(215, 102, 79, 0.16)",
      border: danger,
      glow: glowRose,
      description: "Severe liquidity deficit, critical path clearing only",
    },
    EMERGENCY_HALT: {
      label: "EMERGENCY HALT",
      color: "#FF4D4D",
      bg: "rgba(255, 77, 77, 0.22)",
      border: "#FF4D4D",
      glow: "0 0 16px rgba(255, 77, 77, 0.40)",
      description: "All automated netting frozen pending manual circuit breaker reset",
    },
  },
};

export const tokens = TOKENS;
export default TOKENS;

export type RegimeType = keyof typeof TOKENS.regimes;
