export type User = {
  id: number;
  name: string;
  color: string;
  start_date: string;
  wake_time: string | null;
  // IANA zone (e.g. "Asia/Kolkata"); null for accounts created before the
  // timezone column, until the client next syncs the device zone.
  timezone: string | null;
  has_pin: boolean;
  // Only present on your own record (see GET /api/users?as=).
  share_token?: string;
  // A link anyone can use to join your lobby as a new, editable member --
  // distinct from share_token, which stays read-only.
  invite_token?: string;
};

export type InvitePreview = {
  // A sample, not the whole board -- the endpoint is public and uncredentialed,
  // so it caps what it lists. `total` is the real membership count.
  members: { name: string; color: string }[];
  total: number;
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

export type Insight = {
  text: string;
  generated_at: string;
  cached: boolean;
};
