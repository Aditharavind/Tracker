export type BlockKind = "sleep" | "exercise" | "work" | "meal" | "misc" | "buffer";
export type BlockStatus = "pending" | "acked" | "ignored" | "done";
export type AlarmStage = "t30" | "t10";
export type EventKind = "ack" | "snooze" | "ignore" | "complete";

export type Block = {
  id: number;
  kind: BlockKind;
  title: string;
  start_time: string; // "HH:MM", 24h
  end_time: string;
  status: BlockStatus;
};

export type Schedule = {
  day: string;
  version: number;
  source: string;
  blocks: Block[];
};

export type OnboardPayload = {
  email: string;
  password: string;
  goal_title: string;
  goal_why: string;
  wake_time: string; // "HH:MM"
  sleep_time: string;
  energy_pattern: string;
  meals_per_day: number;
  exercise_needs: string;
  current_habits: string;
};

export type OnboardResult = {
  coach_user_id: number;
  schedule: Schedule;
};
