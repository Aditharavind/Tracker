// The single formula the numeric label and the visual bar must both use --
// see CLAUDE.md section 35. Defensive clamp guards against any caller ever
// passing done > total.
export function dayProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

// pandaPlatformIndex per CLAUDE.md section 25 -- the panda may never sit
// further along the path than the number of tasks actually completed.
export function pandaPlatformIndex(completed: number, total: number): number {
  return Math.min(Math.max(0, completed), Math.max(0, total));
}
