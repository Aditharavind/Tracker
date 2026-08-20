import type { DayDetail, InvitePreview, Progress, TaskItem, User } from "./types";

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
    throw new Error(message);
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

export const api = {
  users: (asUserId?: number) => req<User[]>(`/users${asUserId != null ? `?as=${asUserId}` : ""}`),

  // Convenience only, not auth: if this IP was last seen as a specific
  // user, lets a browser with no saved local user (cleared storage, new
  // device) get pre-selected instead of dropped on the onboarding screen.
  // Editing still needs that user's PIN regardless of what this returns.
  suggestSession: () => req<{ user_id: number | null; name?: string; color?: string }>("/session/suggest"),

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
      }),
    }),

  board: (asUserId?: number) =>
    req<Progress[]>(`/board?today=${todayISO()}${asUserId != null ? `&as=${asUserId}` : ""}`),

  sharedProgress: (token: string) => req<Progress>(`/share/${token}?today=${todayISO()}`),

  inviteInfo: (token: string) => req<InvitePreview>(`/invite/${token}`),

  joinInvite: (token: string, name: string, color: string, pin: string) =>
    req<User>(`/invite/${token}/join`, {
      method: "POST",
      body: JSON.stringify({ name, color, pin, start_date: todayISO() }),
    }),

  day: (userId: number, day: string) => req<DayDetail>(`/users/${userId}/day/${day}`),

  toggle: (userId: number, taskId: number, day: string, done: boolean, pin?: string) =>
    req<{ day: DayDetail; progress: Progress }>(`/users/${userId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, day, done, pin, today: todayISO() }),
    }),

  saveNote: (userId: number, day: string, text: string, pin?: string) =>
    req<{ ok: boolean }>(`/users/${userId}/note`, {
      method: "PUT",
      body: JSON.stringify({ day, text, pin }),
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
