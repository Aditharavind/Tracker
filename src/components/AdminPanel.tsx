import { type FormEvent, useEffect, useMemo, useState } from "react";

type AdminUserStats = {
  id: number;
  name: string;
  color: string;
  group_id: number | null;
  created_at: string | null;
  start_date: string;
  run_start: string;
  timezone: string | null;
  wake_time: string | null;
  day_number: number;
  lives: number;
  initial_lives: number;
  streak: number;
  best_streak: number;
  resets: number;
  xp: number;
  level: number;
  level_name: string;
  completed_today: number;
  core_today: number;
  perfect_today: boolean;
  perfect_days_ever: number;
  task_count: number;
  completion_count: number;
  last_completion_day: string | null;
  dash_best_coins: number;
  dash_best_dist: number;
  has_pin: boolean;
};

type AdminSummary = {
  generated_at: string;
  totals: {
    total_users: number;
    new_users_today: number;
    new_users_7_days: number;
    active_today: number;
    perfect_today: number;
    total_groups: number;
    largest_group: number;
    total_tasks: number;
    total_completions: number;
    average_streak: number;
  };
  users: AdminUserStats[];
};

const TOKEN_KEY = "75hard.admin.basic";

const compactDate = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const statLabel = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace("7 Days", "7 Days");

export default function AdminPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/summary", {
        headers: { Authorization: `Basic ${authToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Wrong admin username or password");
        throw new Error("Could not load admin stats");
      }
      setSummary(await res.json());
      sessionStorage.setItem(TOKEN_KEY, authToken);
      setToken(authToken);
    } catch (e) {
      setSummary(null);
      setError(e instanceof Error ? e.message : "Could not load admin stats");
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) void load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!summary || !needle) return summary?.users ?? [];
    return summary.users.filter((u) =>
      [u.name, String(u.id), String(u.group_id ?? ""), u.timezone ?? ""].some((v) =>
        v.toLowerCase().includes(needle)
      )
    );
  }, [summary, query]);

  const login = (e: FormEvent) => {
    e.preventDefault();
    const next = btoa(`${username}:${password}`);
    void load(next);
  };

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setSummary(null);
    setPassword("");
  };

  return (
    <main className="admin-shell">
      <section className="admin-topbar">
        <div>
          <p className="admin-kicker">Admin Panda</p>
          <h1>75 Hard Control Panel</h1>
        </div>
        {summary && (
          <button className="btn ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </section>

      {!summary && (
        <form className="admin-login" onSubmit={login}>
          <h2>Admin Login</h2>
          <input
            className="field"
            value={username}
            autoComplete="username"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="field"
            value={password}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn primary wide" disabled={loading || !username || !password}>
            {loading ? "Checking..." : "Enter"}
          </button>
          {error && <p className="admin-error">{error}</p>}
        </form>
      )}

      {summary && (
        <>
          <section className="admin-stat-grid">
            {Object.entries(summary.totals).map(([key, value]) => (
              <div className="admin-stat" key={key}>
                <span>{statLabel(key)}</span>
                <strong className="num">{value}</strong>
              </div>
            ))}
          </section>

          <section className="admin-users">
            <div className="admin-users-head">
              <div>
                <h2>Users</h2>
                <p className="muted">Last updated {compactDate(summary.generated_at)}</p>
              </div>
              <div className="admin-actions">
                <input
                  className="field"
                  value={query}
                  placeholder="Search users..."
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn" type="button" onClick={() => load()}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Joined</th>
                    <th>Day</th>
                    <th>Streak</th>
                    <th>Today</th>
                    <th>XP</th>
                    <th>Tasks</th>
                    <th>Completions</th>
                    <th>Dash</th>
                    <th>Group</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user">
                          <i style={{ background: u.color }} />
                          <div>
                            <strong>{u.name}</strong>
                            <span>#{u.id} · {u.timezone ?? "no zone"}</span>
                          </div>
                        </div>
                      </td>
                      <td>{compactDate(u.created_at)}</td>
                      <td className="num">{u.day_number}/75</td>
                      <td className="num">{u.streak} / {u.best_streak}</td>
                      <td className={u.perfect_today ? "admin-good" : ""}>
                        {u.completed_today}/{u.core_today}
                      </td>
                      <td className="num">{u.xp}</td>
                      <td className="num">{u.task_count}</td>
                      <td>
                        <span className="num">{u.completion_count}</span>
                        <small>{u.last_completion_day ?? "never"}</small>
                      </td>
                      <td className="num">{u.dash_best_coins}c / {u.dash_best_dist}m</td>
                      <td className="num">{u.group_id ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
