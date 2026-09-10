// The quote sign at the base of the week map (skill's WeekMap) -- flavour
// text only, never a source of truth for anything (same rule as coins: it
// never gates or records progress, see CLAUDE.md's coin-imprint principle).
export const CONSISTENCY_QUOTES: string[] = [
  "The forest doesn't ask for a perfect day. It asks for the next one.",
  "A stone only becomes a step once you've stood on it seven days running.",
  "Small, repeated, unglamorous -- that's what actually moves the path forward.",
  "You don't need motivation today. You need the day you already promised yourself.",
  "Every week you finish is a stone the next you gets to stand on.",
  "Discipline is just kindness to the version of you who has to keep climbing.",
  "The trail doesn't care how you feel about it. Walk it anyway.",
  "One consistent week beats four inspired days and three skipped ones.",
  "Nothing here unlocks by wanting it. It unlocks by showing up, again.",
  "The panda isn't waiting for you to be ready. It's waiting for day seven.",
];

export function randomQuote(exclude?: string): string {
  if (CONSISTENCY_QUOTES.length <= 1) return CONSISTENCY_QUOTES[0] ?? "";
  let pick = CONSISTENCY_QUOTES[Math.floor(Math.random() * CONSISTENCY_QUOTES.length)];
  while (pick === exclude) pick = CONSISTENCY_QUOTES[Math.floor(Math.random() * CONSISTENCY_QUOTES.length)];
  return pick;
}
