import { type FormEvent, useEffect, useState } from "react";

type AdminUserStats = {
  id: number;
  name: string;
  color: string;
  group_id: number | null;
  created_at: string | null;
  start_date: string;
  run_start: string;
  timezone: string | null;
  timezone_region: string | null;
  last_seen_at: string | null;
  last_country: string | null;
  last_region: string | null;
  last_city: string | null;
  location_label: string;
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
  charts: {
    locations: ChartRow[];
    countries: ChartRow[];
    timezone_regions: ChartRow[];
    signup_days: ChartRow[];
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  users: AdminUserStats[];
};

type ChartRow = { label: string; count: number };

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

function AdminBarChart({ title, rows }: { title: string; rows: ChartRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="admin-chart">
      <h2>{title}</h2>
      <div className="admin-chart-bars">
        {rows.length === 0 ? (
          <p className="muted">No data yet</p>
        ) : (
          rows.map((row) => (
            <div className="admin-chart-row" key={row.label}>
              <span title={row.label}>{row.label}</span>
              <div className="admin-chart-track">
                <i style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} />
              </div>
              <strong className="num">{row.count}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const load = async (authToken = token, nextOffset = offset, nextQuery = query, nextLimit = pageSize) => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(nextLimit),
        offset: String(nextOffset),
      });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const res = await fetch(`/api/admin/summary?${params}`, {
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
    if (!token) return;
    const id = window.setTimeout(() => void load(token, offset, query, pageSize), 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, offset, query, pageSize]);

  const login = (e: FormEvent) => {
    e.preventDefault();
    const next = btoa(`${username}:${password}`);
    setOffset(0);
    void load(next, 0, query, pageSize);
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

          <section className="admin-chart-grid">
            <AdminBarChart title="Login Places" rows={summary.charts.locations} />
            <AdminBarChart title="Countries" rows={summary.charts.countries} />
            <AdminBarChart title="Timezone Regions" rows={summary.charts.timezone_regions} />
            <AdminBarChart title="New Users - 7 Days" rows={summary.charts.signup_days} />
          </section>

          <section className="admin-users">
            <div className="admin-users-head">
              <div>
                <h2>Users</h2>
                <p className="muted">
                  {summary.pagination.total === 0
                    ? "No users found"
                    : `${summary.pagination.offset + 1}-${Math.min(
                        summary.pagination.offset + summary.users.length,
                        summary.pagination.total
                      )} of ${summary.pagination.total}`}
                  {" · "}Last updated {compactDate(summary.generated_at)}
                </p>
              </div>
              <div className="admin-actions">
                <input
                  className="field"
                  value={query}
                  placeholder="Search users..."
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOffset(0);
                  }}
                />
                <select
                  className="field admin-page-size"
                  value={pageSize}
                  aria-label="Rows per page"
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setOffset(0);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <button className="btn" type="button" onClick={() => load(token, offset, query, pageSize)}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Place</th>
                    <th>Joined</th>
                    <th>Last Seen</th>
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
                  {summary.users.map((u) => (
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
                      <td>
                        {u.location_label}
                        <small>{u.last_country ?? u.timezone_region ?? "unknown"}</small>
                      </td>
                      <td>{compactDate(u.created_at)}</td>
                      <td>{compactDate(u.last_seen_at)}</td>
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
            <div className="admin-pagination">
              <button
                className="btn ghost"
                type="button"
                disabled={summary.pagination.offset <= 0 || loading}
                onClick={() => setOffset(Math.max(0, summary.pagination.offset - summary.pagination.limit))}
              >
                Previous
              </button>
              <span className="muted">
                Page {Math.floor(summary.pagination.offset / summary.pagination.limit) + 1}
              </span>
              <button
                className="btn ghost"
                type="button"
                disabled={!summary.pagination.has_more || loading}
                onClick={() => setOffset(summary.pagination.offset + summary.pagination.limit)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
