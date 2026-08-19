import { API_BASE_URL } from "../config";
import type { DayDetail, Progress, TaskItem, User } from "./types";

// Same shape as ../api.ts's `req`, but against the root /api/* routes (the
// 75 Hard tracker) rather than /api/coach/*.
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const hardApi = {
  users: (asUserId?: number) => req<User[]>(`/users${asUserId != null ? `?as=${asUserId}` : ""}`),

  createUser: (name: string, color: string, pin: string, invitedBy?: number) =>
    req<User>("/users", {
      method: "POST",
      body: JSON.stringify({ name, color, pin, invited_by: invitedBy ?? null }),
    }),

  board: (asUserId?: number) => req<Progress[]>(`/board${asUserId != null ? `?as=${asUserId}` : ""}`),

  day: (userId: number, day: string) => req<DayDetail>(`/users/${userId}/day/${day}`),

  toggle: (userId: number, taskId: number, day: string, done: boolean, pin?: string) =>
    req<{ day: DayDetail; progress: Progress }>(`/users/${userId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, day, done, pin }),
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
};

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
};
