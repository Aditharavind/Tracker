import type { DayDetail, Progress, TaskItem, User } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  users: () => req<User[]>("/users"),

  createUser: (
    name: string,
    color: string,
    pin: string,
    wakeTime?: string | null,
    repsTarget?: number
  ) =>
    req<User>("/users", {
      method: "POST",
      body: JSON.stringify({ name, color, pin, wake_time: wakeTime || null, reps_target: repsTarget ?? 20 }),
    }),

  board: () => req<Progress[]>("/board"),

  day: (userId: number, day: string) => req<DayDetail>(`/users/${userId}/day/${day}`),

  toggle: (userId: number, taskId: number, day: string, done: boolean, pin?: string) =>
    req<{ day: DayDetail; progress: Progress }>(`/users/${userId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, day, done, pin }),
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
    req<Progress>(`/users/${userId}/restart`, { method: "POST", body: JSON.stringify({ pin }) }),

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

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
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
