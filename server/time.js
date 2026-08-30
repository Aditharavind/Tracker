/**
 * Timezone-aware "what day is it for this user" helpers.
 *
 * The engine works entirely in 'YYYY-MM-DD' strings and never needs a clock of
 * its own -- it is handed the day the caller considers "today". Historically
 * that day came straight off the calling browser's local clock, which is wrong
 * the moment one browser asks about another user (the board, a share link): it
 * judged everyone against the viewer's midnight.
 *
 * Each user now stores an IANA zone (e.g. "Asia/Kolkata"), and these turn that
 * into their current local day, server-side, consistently.
 */

/**
 * The user's current local day as 'YYYY-MM-DD'. `en-CA` formats dates in ISO
 * order, so this is just a locale trick, not string surgery. Returns null for a
 * missing or unrecognised zone so callers can fall back.
 */
export function zoneToday(tz, now = new Date()) {
  if (!tz || typeof tz !== "string") return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  } catch {
    return null;
  }
}

/** Whether a string is a zone this runtime's Intl actually knows. */
export function isValidZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
