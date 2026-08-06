import { API_BASE_URL } from "./config";
import type { AlarmStage, EventKind, OnboardPayload, OnboardResult, Schedule } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/coach${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

export const api = {
  onboard: (payload: OnboardPayload) =>
    req<OnboardResult>("/onboard", { method: "POST", body: JSON.stringify(payload) }),

  today: (coachUserId: number) => req<Schedule>(`/plan/today?coach_user_id=${coachUserId}`),

  logEvent: (coachUserId: number, blockId: number, kind: EventKind, stage?: AlarmStage) =>
    req<{ ok: boolean }>("/events", {
      method: "POST",
      body: JSON.stringify({ coach_user_id: coachUserId, block_id: blockId, kind, stage }),
    }),
};
