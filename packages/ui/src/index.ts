/**
 * @omega/ui
 *
 * SCAFFOLD — framework-free types only (no React dependency).
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

export interface CosmosPalette {
  background: string;
  gold: string;
  trustGold: string;
  memberCyan: string;
  opsGreen: string;
  royaltyPurple: string;
}

export const DEFAULT_PALETTE: CosmosPalette = {
  background: "#030308",
  gold: "#d4af37",
  trustGold: "#ffd700",
  memberCyan: "#22d3ee",
  opsGreen: "#34d399",
  royaltyPurple: "#a78bfa",
};

export interface HudPanelProps {
  title: string;
  ring?: RingType;
}

export const UI_STATUS = "SCAFFOLD" as const;
