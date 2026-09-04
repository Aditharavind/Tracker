import { describe, expect, it } from "vitest";
import { ALARM_WINDOW_MIN, isAlarmDue, minutesSinceDue, toMinutes } from "../alarm";

/** Local-time Date for today at HH:MM -- the alarm reads the device clock. */
const at = (hh: number, mm: number) => {
  const d = new Date(2026, 8, 2, hh, mm, 0, 0);
  return d;
};

describe("toMinutes", () => {
  it("accepts the <input type=time> form", () => {
    expect(toMinutes("06:00")).toBe(360);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("accepts the Postgres time form, which is what the API actually returns", () => {
    expect(toMinutes("06:00:00")).toBe(360);
    expect(toMinutes("23:59:59")).toBe(1439);
  });

  it("rejects junk rather than guessing", () => {
    for (const bad of ["", "6:00", "24:00", "12:60", "abc", "06-00", null, undefined, 600]) {
      expect(toMinutes(bad as string)).toBeNull();
    }
  });
});

describe("minutesSinceDue", () => {
  it("counts up from the wake time", () => {
    expect(minutesSinceDue("06:00", at(6, 0))).toBe(0);
    expect(minutesSinceDue("06:00", at(6, 30))).toBe(30);
    expect(minutesSinceDue("06:00", at(7, 0))).toBe(60);
  });

  it("wraps across midnight instead of going negative", () => {
    // 23:30 alarm, 00:10 now -- 40 minutes late, not 1400.
    expect(minutesSinceDue("23:30", at(0, 10))).toBe(40);
    expect(minutesSinceDue("00:05", at(0, 0))).toBe(1435);
  });
});

describe("isAlarmDue", () => {
  it("rings at the wake time and through the window", () => {
    expect(isAlarmDue("06:00", at(6, 0))).toBe(true);
    expect(isAlarmDue("06:00", at(6, 30))).toBe(true);
    expect(isAlarmDue("06:00", at(6, 59))).toBe(true);
  });

  it("stops once the window is over -- the bug this replaces", () => {
    // The old string compare had this true right up to 23:59.
    expect(isAlarmDue("06:00", at(7, 0))).toBe(false);
    expect(isAlarmDue("06:00", at(11, 12))).toBe(false);
    expect(isAlarmDue("06:00", at(17, 0))).toBe(false);
    expect(isAlarmDue("06:00", at(23, 59))).toBe(false);
  });

  it("does not ring before the wake time", () => {
    expect(isAlarmDue("06:00", at(5, 59))).toBe(false);
    expect(isAlarmDue("06:00", at(0, 0))).toBe(false);
  });

  it("rings past midnight for a late wake time", () => {
    expect(isAlarmDue("23:30", at(23, 30))).toBe(true);
    expect(isAlarmDue("23:30", at(0, 10))).toBe(true);
    expect(isAlarmDue("23:30", at(0, 31))).toBe(false);
  });

  it("treats both time formats identically", () => {
    for (const now of [at(6, 0), at(6, 30), at(12, 0)]) {
      expect(isAlarmDue("06:00", now)).toBe(isAlarmDue("06:00:00", now));
    }
  });

  it("never rings for a missing or malformed time", () => {
    // A bad value in the database must not be able to pin the siren on.
    for (const bad of [null, undefined, "", "nope", "25:00"]) {
      expect(isAlarmDue(bad as string, at(6, 0))).toBe(false);
      expect(isAlarmDue(bad as string, at(12, 0))).toBe(false);
    }
  });

  it("honours a custom window", () => {
    expect(isAlarmDue("06:00", at(6, 10), 5)).toBe(false);
    expect(isAlarmDue("06:00", at(6, 4), 5)).toBe(true);
  });

  it("ships with an hour-long window", () => {
    expect(ALARM_WINDOW_MIN).toBe(60);
  });
});
