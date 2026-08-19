// Port of frontend/src/game/progress.ts -- see there for rationale.

export function dayProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function pandaPlatformIndex(completed: number, total: number): number {
  return Math.min(Math.max(0, completed), Math.max(0, total));
}
