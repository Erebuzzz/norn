import React, { useState, useEffect } from "react";
import { tokens } from "../tokens.js";
import { sound } from "../sound.js";

export interface SoundToggleProps {
  style?: React.CSSProperties;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ style }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());

  const handleToggle = () => {
    const nextState = sound.toggleMute();
    setIsMuted(nextState);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isMuted ? "Unmute Sonic Telemetry" : "Mute Sonic Telemetry"}
      title={isMuted ? "Unmute Sonic Telemetry" : "Mute Sonic Telemetry"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: tokens.panel,
        border: `1px solid ${isMuted ? tokens.border : tokens.active}`,
        borderRadius: "4px",
        padding: "4px 8px",
        color: isMuted ? tokens.textMuted : tokens.active,
        fontFamily: tokens.fontFamily.mono,
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        cursor: "pointer",
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isMuted ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
      <span>{isMuted ? "SONIC: MUTED" : "SONIC: ACTIVE"}</span>
    </button>
  );
};

export default SoundToggle;
