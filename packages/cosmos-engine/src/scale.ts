/**
 * @omega/cosmos-engine — universe scale levels (pure logic, no WebGL)
 *
 * Camera distances for stepping out through the real cosmic hierarchy:
 * star system → galaxy → galaxy cluster → cosmic filament → cosmic web.
 *
 * Creator: David Charles Bourassa
 */

export type ScaleLevelId = "system" | "galaxy" | "cluster" | "filament" | "web";

export interface ScaleLevel {
  id: ScaleLevelId;
  label: string;
  /** Camera distance from the controls target at this level. */
  distance: number;
  blurb: string;
}

export const UNIVERSE_SCALES: readonly ScaleLevel[] = [
  {
    id: "system",
    label: "Star System",
    distance: 26,
    blurb:
      "A single star system — one star, its planets and the local neighbourhood, a few light-hours across.",
  },
  {
    id: "galaxy",
    label: "Galaxy",
    distance: 78,
    blurb:
      "A whole galaxy — hundreds of billions of stars bound by gravity, roughly 100,000 light-years across.",
  },
  {
    id: "cluster",
    label: "Galaxy Cluster",
    distance: 190,
    blurb:
      "A galaxy cluster — hundreds to thousands of galaxies bound together, millions of light-years across.",
  },
  {
    id: "filament",
    label: "Cosmic Filament",
    distance: 420,
    blurb:
      "A cosmic filament — a vast thread of galaxy clusters and dark matter stretching hundreds of millions of light-years.",
  },
  {
    id: "web",
    label: "Cosmic Web",
    distance: 820,
    blurb:
      "The cosmic web — the large-scale structure of the universe itself: filaments and walls surrounding near-empty voids.",
  },
];

export function scaleLevelFor(id: ScaleLevelId): ScaleLevel {
  const found = UNIVERSE_SCALES.find((s) => s.id === id);
  // UNIVERSE_SCALES covers every ScaleLevelId by construction.
  return found ?? (UNIVERSE_SCALES[0] as ScaleLevel);
}
