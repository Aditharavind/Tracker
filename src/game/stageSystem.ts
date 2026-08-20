// The 75-day journey is six chapters of the same run, not six challenges.
// Stage is always derived from the day number -- never stored independently.

export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

export type StageMeta = {
  id: StageId;
  theme: string;
  name: string;
  minDay: number;
  maxDay: number;
};

export const STAGES: StageMeta[] = [
  { id: 1, theme: "entrance", name: "Forest Entrance", minDay: 1, maxDay: 12 },
  { id: 2, theme: "mossy-trail", name: "Mossy Trail", minDay: 13, maxDay: 25 },
  { id: 3, theme: "moonlit-grove", name: "Moonlit Grove", minDay: 26, maxDay: 38 },
  { id: 4, theme: "ancient-forest", name: "Ancient Forest", minDay: 39, maxDay: 50 },
  { id: 5, theme: "golden-canopy", name: "Golden Canopy", minDay: 51, maxDay: 63 },
  { id: 6, theme: "summit-sanctuary", name: "Summit Sanctuary", minDay: 64, maxDay: 75 },
];

export function getStage(day: number): StageMeta {
  const clamped = Math.min(75, Math.max(1, Math.round(day)));
  return STAGES.find((s) => clamped >= s.minDay && clamped <= s.maxDay) ?? STAGES[STAGES.length - 1];
}
