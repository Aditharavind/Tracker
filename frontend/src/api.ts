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

  createUser: (name: string, color: string) =>
    req<User>("/users", { method: "POST", body: JSON.stringify({ name, color }) }),

  board: () => req<Progress[]>("/board"),

  day: (userId: number, day: string) => req<DayDetail>(`/users/${userId}/day/${day}`),

  toggle: (userId: number, taskId: number, day: string, done: boolean) =>
    req<{ day: DayDetail; progress: Progress }>(`/users/${userId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, day, done }),
    }),

  saveNote: (userId: number, day: string, text: string) =>
    req<{ ok: boolean }>(`/users/${userId}/note`, {
      method: "PUT",
      body: JSON.stringify({ day, text }),
    }),

  addTask: (userId: number, title: string, emoji: string, isCore: boolean) =>
    req<TaskItem>(`/users/${userId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, emoji, is_core: isCore }),
    }),

  removeTask: (userId: number, taskId: number) =>
    req<void>(`/users/${userId}/tasks/${taskId}`, { method: "DELETE" }),

  restart: (userId: number) => req<Progress>(`/users/${userId}/restart`, { method: "POST" }),
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
