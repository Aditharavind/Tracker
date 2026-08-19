/**
 * The seven official 75 Hard rules.
 *
 * On Supabase these rows are inserted by the seed_core_tasks() trigger in
 * supabase/schema.sql -- this list exists so the in-memory store used by the
 * tests and by offline `npm run dev` behaves identically. Keep the two in
 * sync if you ever edit them.
 */
export const CORE_TASKS = [
  ["Two 45-min workouts", "\u{1F3CB}"],
  ["One workout outdoors", "\u{1F333}"],
  ["Follow the diet, no cheats", "\u{1F957}"],
  ["No alcohol", "\u{1F6AB}"],
  ["1 gallon of water", "\u{1F4A7}"],
  ["Read 10 pages", "\u{1F4D6}"],
  ["Progress photo", "\u{1F4F8}"],
];
