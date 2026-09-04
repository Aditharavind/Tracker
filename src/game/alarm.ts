/**
 * When the wake-up alarm is due.
 *
 * This used to be a bare string comparison in App.tsx:
 *
 *     new Date().toTimeString().slice(0, 8) >= user.wake_time
 *
 * which is true from the wake time until midnight. Set it for 06:00, open the
 * app at 17:00 without having ticked your reps, and you got a full-screen
 * overlay and a siren telling you it was time to get up. An alarm is an event,
 * not a state -- so it now rings for a window after the time it was set for and
 * then stops. The reps task stays unticked in the list either way; only the
 * siren is bounded.
 *
 * Doing it in minutes rather than on strings also fixes two latent problems:
 * the comparison had to cope with 'HH:MM' from an <input type="time"> and
 * 'HH:MM:SS' from Postgres' time column, and a window that runs past midnight
 * (set 23:30, it should still ring at 00:10) is not expressible as a string
 * range at all.
 */

/** How long the alarm keeps ringing after the time it was set for. */
export const ALARM_WINDOW_MIN = 60;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/**
 * 'HH:MM' or 'HH:MM:SS' as minutes past midnight, or null if it is neither.
 * Postgres hands back the seconds form, an <input type="time"> the short one.
 */
export function toMinutes(time: string | null | undefined): number | null {
  if (typeof time !== "string") return null;
  const m = HHMM.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Minutes elapsed since the alarm was last due, 0-1439.
 *
 * Wraps, so an alarm set for 23:30 reads as 40 minutes overdue at 00:10 rather
 * than as something that happened 1400 minutes ago and can never ring again.
 */
export function minutesSinceDue(wakeTime: string, now: Date): number | null {
  const wake = toMinutes(wakeTime);
  if (wake === null) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (nowMin - wake + 1440) % 1440;
}

/**
 * Is the alarm ringing right now? False for a malformed time, so a bad value in
 * the database can never pin a siren on permanently.
 */
export function isAlarmDue(
  wakeTime: string | null | undefined,
  now: Date,
  windowMin: number = ALARM_WINDOW_MIN
): boolean {
  if (typeof wakeTime !== "string") return false;
  const since = minutesSinceDue(wakeTime, now);
  return since !== null && since < windowMin;
}
