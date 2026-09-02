import type { DayDetail, InvitePreview, Progress, TaskItem, User } from "./types";

/**
 * A request that reached the server and came back refused, as opposed to one
 * that never arrived. The outbox needs to tell those apart: a 4xx will be
 * refused identically forever and must be dropped, while a dropped connection
 * is worth retrying. `message` is left exactly as before -- runWithPin matches
 * /pin/i on it.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True for a refusal the server will repeat, so retrying is pointless. */
export const isPermanentFailure = (err: unknown): boolean =>
  err instanceof ApiError && err.status >= 400 && err.status < 500;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    // The Express backend answers with {"error": "..."}; runWithPin matches
    // /pin/i on this message, so the raw JSON envelope would break it.
    let message = res.statusText;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/**
 * The user's *local* day. The server runs in UTC on Vercel, so every call that
 * depends on "what day is it" carries this along -- otherwise someone in IST
 * ticking a box at 09:00 would be judged against yesterday's UTC date.
 */
export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
};

/**
 * The device's IANA timezone (e.g. "Asia/Kolkata"). No permission prompt --
 * this is the zone the OS is already set to. Sent at signup and re-synced
 * whenever it changes, so the server can decide each user's day boundary.
 */
export const deviceTimezone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export const api = {
  users: (asUserId?: number) => req<User[]>(`/users${asUserId != null ? `?as=${asUserId}` : ""}`),

  // Convenience only, not auth: if this IP was last seen as a specific
  // user, lets a browser with no saved local user (cleared storage, new
  // device) get pre-selected instead of dropped on the onboarding screen.
  // Editing still needs that user's PIN regardless of what this returns.
  suggestSession: () => req<{ user_id: number | null; name?: string; color?: string }>("/session/suggest"),

  /**
   * Sign back in after signing out, or on a new device. This is the one place
   * the PIN is still checked (server-side, against pin_hash) -- it has to be,
   * or the name alone would hand over someone else's board.
   */
  login: (name: string, pin: string) =>
    req<User>("/login", {
      method: "POST",
      body: JSON.stringify({ name, pin, timezone: deviceTimezone() }),
    }),

  createUser: (
    name: string,
    color: string,
    pin: string,
    wakeTime?: string | null,
    repsTarget?: number,
    invitedBy?: number
  ) =>
    req<User>("/users", {
      method: "POST",
      body: JSON.stringify({
        name,
        color,
        pin,
        wake_time: wakeTime || null,
        reps_target: repsTarget ?? 20,
        invited_by: invitedBy ?? null,
        start_date: todayISO(),
        timezone: deviceTimezone(),
      }),
    }),

  board: (asUserId?: number) =>
    req<Progress[]>(`/board?today=${todayISO()}${asUserId != null ? `&as=${asUserId}` : ""}`),

  sharedProgress: (token: string) => req<Progress>(`/share/${token}?today=${todayISO()}`),

  inviteInfo: (token: string) => req<InvitePreview>(`/invite/${token}`),

  joinInvite: (token: string, name: string, color: string, pin: string) =>
    req<User>(`/invite/${token}/join`, {
      method: "POST",
      body: JSON.stringify({ name, color, pin, start_date: todayISO(), timezone: deviceTimezone() }),
    }),

  day: (userId: number, day: string) => req<DayDetail>(`/users/${userId}/day/${day}`),

  toggle: (userId: number, taskId: number, day: string, done: boolean, pin?: string) =>
    req<{ day: DayDetail; progress: Progress }>(`/users/${userId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, day, done, pin, today: todayISO() }),
      // Ticking a box and immediately closing / backgrounding the tab used to
      // lose the write: browsers abort in-flight fetches when the document is
      // dismissed. keepalive lets this one outlive the page. The body is a
      // hundred-odd bytes, far inside the 64KB budget the spec allows.
      keepalive: true,
    }),

  saveNote: (userId: number, day: string, text: string, pin?: string) =>
    req<{ ok: boolean }>(`/users/${userId}/note`, {
      method: "PUT",
      body: JSON.stringify({ day, text, pin, today: todayISO() }),
    }),

  addTask: (userId: number, title: string, emoji: string, isCore: boolean, pin?: string) =>
    req<TaskItem>(`/users/${userId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, emoji, is_core: isCore, pin }),
    }),

  removeTask: (userId: number, taskId: number, pin?: string) =>
    req<void>(`/users/${userId}/tasks/${taskId}`, { method: "DELETE", body: JSON.stringify({ pin }) }),

  restart: (userId: number, pin?: string) =>
    req<Progress>(`/users/${userId}/restart`, {
      method: "POST",
      body: JSON.stringify({ pin, today: todayISO() }),
    }),

  setPin: (userId: number, newPin: string, pin?: string) =>
    req<{ ok: boolean }>(`/users/${userId}/pin`, {
      method: "PUT",
      body: JSON.stringify({ new_pin: newPin, pin }),
    }),

  setWake: (userId: number, wakeTime: string | null, repsTarget: number, pin?: string) =>
    req<User>(`/users/${userId}/wake`, {
      method: "PUT",
      body: JSON.stringify({ wake_time: wakeTime, reps_target: repsTarget, pin }),
    }),

  setTimezone: (userId: number, timezone: string | null, pin?: string) =>
    req<User>(`/users/${userId}/timezone`, {
      method: "PUT",
      body: JSON.stringify({ timezone, pin }),
    }),

  health: () => req<{ store: string; ok: boolean; checks: Record<string, unknown> }>("/health"),

  submitDash: (userId: number, coins: number, distance: number) =>
    req<{ coins: number; distance: number }>(`/users/${userId}/dash`, {
      method: "POST",
      body: JSON.stringify({ coins, distance }),
    }),

  dashLeaderboard: () =>
    req<{ name: string; color: string; coins: number; distance: number }[]>("/dash/leaderboard"),
};

export const shiftISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
