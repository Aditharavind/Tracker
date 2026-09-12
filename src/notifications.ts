// Real browser notifications for a still-incomplete day -- opt-in, asked for
// once (then not re-asked for a week if declined/dismissed), and capped to
// one nudge per real calendar day so it reads as a gentle reminder rather
// than a nag. This only fires while the tab/app is actually running; true
// delivery with the tab fully closed needs a server-side Web Push
// subscription (VAPID keys + a backend scheduler), which is a separate,
// bigger feature this does not attempt.

const DISMISS_KEY = "75hard.notify.dismissedAt";
const SENT_KEY_PREFIX = "75hard.notify.sent:";
// A single evening nudge, not a barrage -- past this local hour, if the day
// still isn't clear, it's worth a reminder.
const REMINDER_HOUR = 20;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export function dismissPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode -- nothing to persist, it'll just ask again next visit */
  }
}

/** Whether the peek prompt should show at all -- only when permission is still undecided, and not right after a decline/dismiss. */
export function shouldOfferPrompt(): boolean {
  if (!notificationsSupported() || Notification.permission !== "default") return false;
  try {
    const dismissed = Number(localStorage.getItem(DISMISS_KEY));
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) return false;
  } catch {
    /* private mode -- just offer it every time rather than block on a read that can't work */
  }
  return true;
}

/**
 * Fires at most once per local calendar day (`todayKey`, e.g. "2026-09-11"),
 * only once the reminder hour has passed and tasks are still incomplete.
 * Safe to call often (e.g. every few minutes) -- the localStorage guard
 * makes repeat calls a no-op for the rest of that day.
 */
export function maybeRemind(todayKey: string, completed: number, total: number): void {
  if (getPermission() !== "granted") return;
  if (total <= 0 || completed >= total) return;
  if (new Date().getHours() < REMINDER_HOUR) return;
  const key = SENT_KEY_PREFIX + todayKey;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    return; // can't dedupe safely -- skip rather than risk spamming
  }
  const left = total - completed;
  new Notification("75 Hard — don't lose the day", {
    body: `${left} task${left === 1 ? "" : "s"} left today. The panda's still waiting.`,
    icon: "/icon-192.png",
    tag: "75hard-daily-reminder",
  });
}
