export type User = {
  id: number;
  name: string;
  color: string;
  start_date: string;
  wake_time: string | null;
  has_pin: boolean;
};

export type Badge = {
  day: number;
  name: string;
  blurb: string;
  earned: boolean;
};

export type DayCell = {
  day: string;
  index: number;
  status: "done" | "partial" | "missed" | "today" | "future";
  done: number;
  total: number;
};

export type Progress = {
  user_id: number;
  name: string;
  color: string;
  run_start: string;
  day_number: number;
  streak: number;
  best_streak: number;
  resets: number;
  completed_today: number;
  core_today: number;
  perfect_today: boolean;
  xp: number;
  level: number;
  level_name: string;
  level_floor: number;
  level_ceiling: number | null;
  perfect_days_ever: number;
  badges: Badge[];
  next_badge: Badge | null;
  calendar: DayCell[];
};

export type TaskItem = {
  id: number;
  title: string;
  emoji: string;
  is_core: boolean;
  locked: boolean;
  reps_target: number | null;
  done: boolean;
};

export type DayDetail = {
  day: string;
  tasks: TaskItem[];
  pending: TaskItem[];
  note: string;
};
