/**
 * server/time.js -- turning an IANA zone into "what day is it for this user".
 */
import assert from "node:assert/strict";
import test from "node:test";

import { isValidZone, zoneToday } from "../server/time.js";

test("zoneToday formats the local day as YYYY-MM-DD for a real zone", () => {
  const day = zoneToday("Asia/Kolkata");
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
});

test("zones east and west of the date line can disagree on the day", () => {
  // 03:00 UTC on the 15th: Kiritimati (UTC+14) is already the 15th 17:00,
  // Honolulu (UTC-10) is still the 14th 17:00.
  const instant = new Date("2026-03-15T03:00:00Z");
  assert.equal(zoneToday("Pacific/Kiritimati", instant), "2026-03-15");
  assert.equal(zoneToday("Pacific/Honolulu", instant), "2026-03-14");
});

test("a missing or unknown zone yields null, never a throw", () => {
  assert.equal(zoneToday(null), null);
  assert.equal(zoneToday(""), null);
  assert.equal(zoneToday("Not/AZone"), null);
});

test("isValidZone accepts IANA names and rejects junk", () => {
  assert.equal(isValidZone("Europe/London"), true);
  assert.equal(isValidZone("America/New_York"), true);
  assert.equal(isValidZone("Mars/Olympus"), false);
  assert.equal(isValidZone(""), false);
  assert.equal(isValidZone(undefined), false);
});
