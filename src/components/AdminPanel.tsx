import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

type AdminUserStats = {
  id: number; name: string; color: string; group_id: number | null; created_at: string | null;
  start_date: string; run_start: string; timezone: string | null; timezone_region: string | null;
  last_seen_at: string | null; last_country: string | null; last_region: string | null;
  last_city: string | null; location_label: string; wake_time: string | null; day_number: number;
  lives: number; initial_lives: number; streak: number; best_streak: number; resets: number;
  xp: number; level: number; level_name: string; completed_today: number; core_today: number;
  perfect_today: boolean; perfect_days_ever: number; task_count: number; completion_count: number;
  last_completion_day: string | null; dash_best_coins: number; dash_best_dist: number; has_pin: boolean;
};

type ChartRow = { label: string; count: number };
type AdminSummary = {
  generated_at: string;
  totals: {
    total_users: number; new_users_today: number; new_users_7_days: number; active_today: number;
    perfect_today: number; total_groups: number; largest_group: number; total_tasks: number;
    total_completions: number; average_streak: number;
  };
  charts: { locations: ChartRow[]; countries: ChartRow[]; timezone_regions: ChartRow[]; signup_days: ChartRow[] };
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
  users: AdminUserStats[];
};

const TOKEN_KEY = "75hard.admin.basic";

const encodeBasic = (username: string, password: string) => {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const dateLabel = (iso: string | null, includeTime = false) => {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return includeTime
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const shortDay = (label: string) => {
  const date = new Date(`${label}T00:00:00`);
  return Number.isNaN(date.getTime()) ? label : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
};

function AdminBarChart({ title, description, rows, dates = false }: { title: string; description: string; rows: ChartRow[]; dates?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return <article className="admin-chart">
    <header><div><h2>{title}</h2><p>{description}</p></div></header>
    <div className="admin-chart-bars">
      {rows.length === 0 ? <p className="admin-empty-copy">No data available yet.</p> : rows.map(row => <div className="admin-chart-row" key={row.label}>
        <span title={row.label}>{dates ? shortDay(row.label) : row.label}</span>
        <div className="admin-chart-track" aria-hidden="true"><i style={{ width: `${Math.max(4, row.count / max * 100)}%` }} /></div>
        <strong className="num">{row.count}</strong>
      </div>)}
    </div>
  </article>;
}

function UserCard({ user }: { user: AdminUserStats }) {
  const todayPercent = user.core_today > 0 ? Math.min(100, user.completed_today / user.core_today * 100) : 0;
  const status = user.perfect_today ? "Complete today" : user.completed_today > 0 ? "In progress" : "No tasks completed today";
  return <article className="admin-user-card">
    <header className="admin-user-card-head">
      <div className="admin-user-identity">
        <i style={{ background: user.color }} aria-hidden="true" />
        <div><h3>{user.name}</h3><p>Account #{user.id}{user.group_id == null ? "" : ` · Group ${user.group_id}`}</p></div>
      </div>
      <span className={`admin-status${user.perfect_today ? " complete" : user.completed_today > 0 ? " active" : ""}`}>{status}</span>
    </header>

    <div className="admin-user-metrics">
      <div><span>Journey</span><strong>Day {user.day_number}<small> / 75</small></strong></div>
      <div><span>Current streak</span><strong>{user.streak}<small> days</small></strong></div>
      <div><span>Lives</span><strong>{user.lives}<small> / {user.initial_lives}</small></strong></div>
      <div><span>Today</span><strong>{user.completed_today}<small> / {user.core_today}</small></strong></div>
    </div>
    <div className="admin-user-progress" aria-label={`${user.completed_today} of ${user.core_today} core tasks complete today`}><i style={{ width: `${todayPercent}%` }} /></div>

    <dl className="admin-user-summary">
      <div><dt>Last active</dt><dd title={user.last_seen_at ?? undefined}>{dateLabel(user.last_seen_at, true)}</dd></div>
      <div><dt>Location</dt><dd>{user.location_label || "Unknown"}</dd></div>
      <div><dt>Time zone</dt><dd>{user.timezone ?? "Not set"}</dd></div>
    </dl>

    <details className="admin-user-details">
      <summary>More user details</summary>
      <dl>
        <div><dt>Joined</dt><dd>{dateLabel(user.created_at)}</dd></div>
        <div><dt>Run started</dt><dd>{dateLabel(user.run_start)}</dd></div>
        <div><dt>Level</dt><dd>{user.level} · {user.level_name}</dd></div>
        <div><dt>XP</dt><dd>{user.xp}</dd></div>
        <div><dt>Best streak</dt><dd>{user.best_streak} days</dd></div>
        <div><dt>Resets</dt><dd>{user.resets}</dd></div>
        <div><dt>Perfect days</dt><dd>{user.perfect_days_ever}</dd></div>
        <div><dt>Tasks</dt><dd>{user.task_count}</dd></div>
        <div><dt>Total completions</dt><dd>{user.completion_count}</dd></div>
        <div><dt>Last completion</dt><dd>{user.last_completion_day ?? "Never"}</dd></div>
        <div><dt>Forest Dash best</dt><dd>{user.dash_best_coins} coins · {user.dash_best_dist}m</dd></div>
        <div><dt>Wake time</dt><dd>{user.wake_time ?? "Not set"}</dd></div>
        <div><dt>PIN</dt><dd>{user.has_pin ? "Set" : "Missing"}</dd></div>
      </dl>
    </details>
  </article>;
}

export default function AdminPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const request = useRef<{ id: number; controller: AbortController } | null>(null);

  const load = useCallback(async (authToken: string, nextOffset: number, nextQuery: string, nextLimit: number, refresh = false) => {
    if (!authToken) return;
    request.current?.controller.abort();
    const current = { id: (request.current?.id ?? 0) + 1, controller: new AbortController() };
    request.current = current;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(nextLimit), offset: String(nextOffset) });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (refresh) params.set("refresh", "1");
      const response = await fetch(`/api/admin/summary?${params}`, {
        headers: { Authorization: `Basic ${authToken}` }, signal: current.controller.signal,
      });
      if (response.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY); setToken(""); setSummary(null);
        throw new Error("The admin username or password is incorrect.");
      }
      if (response.status === 503) throw new Error("Admin access is not configured on this deployment.");
      if (!response.ok) throw new Error(`The dashboard could not load (server returned ${response.status}).`);
      const data = await response.json() as AdminSummary;
      if (request.current?.id !== current.id) return;
      setSummary(data); sessionStorage.setItem(TOKEN_KEY, authToken);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (request.current?.id === current.id) setError(reason instanceof Error ? reason.message : "The dashboard could not load.");
    } finally {
      if (request.current?.id === current.id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void load(token, offset, query, pageSize), query ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, offset, pageSize, query, token]);
  useEffect(() => () => request.current?.controller.abort(), []);

  const login = (event: FormEvent) => {
    event.preventDefault(); setError(null); setLoading(true); setOffset(0);
    setToken(encodeBasic(username.trim(), password));
  };
  const signOut = () => {
    request.current?.controller.abort(); sessionStorage.removeItem(TOKEN_KEY);
    setToken(""); setSummary(null); setPassword(""); setError(null); setLoading(false);
  };

  const totalPages = summary ? Math.max(1, Math.ceil(summary.pagination.total / summary.pagination.limit)) : 1;
  const currentPage = summary ? Math.floor(summary.pagination.offset / summary.pagination.limit) + 1 : 1;
  const activityRate = summary?.totals.total_users ? Math.round(summary.totals.active_today / summary.totals.total_users * 100) : 0;

  return <main className="admin-shell">
    <header className="admin-topbar">
      <div><p className="admin-kicker">Admin Panda</p><h1>User overview</h1><p className="admin-subtitle">See growth, today’s activity, and each user’s current journey.</p></div>
      {token && <button className="btn ghost" type="button" onClick={signOut}>Sign out</button>}
    </header>

    {!summary && !token && <form className="admin-login" onSubmit={login}>
      <div><p className="admin-kicker">Protected area</p><h2>Admin sign in</h2><p>Enter the admin credentials to view user activity.</p></div>
      <label>Username<input className="field" value={username} autoComplete="username" onChange={event => setUsername(event.target.value)} /></label>
      <label>Password<input className="field" value={password} type="password" autoComplete="current-password" onChange={event => setPassword(event.target.value)} /></label>
      <button className="btn primary wide" disabled={loading || !username.trim() || !password}>{loading ? "Signing in…" : "Open dashboard"}</button>
      {error && <p className="admin-error" role="alert">{error}</p>}
    </form>}

    {!summary && token && <section className="admin-session-state" aria-live="polite">
      <span className="admin-loader" aria-hidden="true" /><h2>{error ? "Dashboard unavailable" : "Loading dashboard"}</h2>
      <p>{error ?? "Getting the latest user activity…"}</p>
      {error && <button className="btn primary" type="button" onClick={() => void load(token, offset, query, pageSize, true)}>Try again</button>}
    </section>}

    {summary && <div className="admin-dashboard" aria-busy={loading}>
      {error && <div className="admin-alert" role="alert"><span>{error} Your existing dashboard data is still shown.</span><button type="button" onClick={() => void load(token, offset, query, pageSize, true)}>Retry</button></div>}

      <section className="admin-stat-grid" aria-label="Key metrics">
        <article className="admin-stat primary"><span>Total users</span><strong className="num">{summary.totals.total_users}</strong><small>All registered accounts</small></article>
        <article className="admin-stat"><span>Active today</span><strong className="num">{summary.totals.active_today}</strong><small>{activityRate}% of all users</small></article>
        <article className="admin-stat good"><span>Finished today</span><strong className="num">{summary.totals.perfect_today}</strong><small>Completed every core task</small></article>
        <article className="admin-stat"><span>New this week</span><strong className="num">{summary.totals.new_users_7_days}</strong><small>{summary.totals.new_users_today} joined today</small></article>
        <article className="admin-stat"><span>Average streak</span><strong className="num">{summary.totals.average_streak}</strong><small>Current days per user</small></article>
        <article className="admin-stat"><span>Groups</span><strong className="num">{summary.totals.total_groups}</strong><small>Largest has {summary.totals.largest_group} users</small></article>
      </section>

      <section className="admin-secondary-stats" aria-label="Platform totals">
        <span><b className="num">{summary.totals.total_tasks}</b> tasks</span>
        <span><b className="num">{summary.totals.total_completions}</b> task completions</span>
        <span>Updated <time dateTime={summary.generated_at}>{dateLabel(summary.generated_at, true)}</time></span>
        {loading && <span className="admin-refreshing">Refreshing…</span>}
      </section>

      <section className="admin-chart-grid" aria-label="Audience charts">
        <AdminBarChart title="Sign-ups" description="New accounts during the last seven days" rows={summary.charts.signup_days} dates />
        <AdminBarChart title="Recent locations" description="Places reported during recent activity" rows={summary.charts.locations} />
        <AdminBarChart title="Countries" description="Users by last reported country" rows={summary.charts.countries} />
        <AdminBarChart title="Time zones" description="Users grouped by time-zone region" rows={summary.charts.timezone_regions} />
      </section>

      <section className="admin-users">
        <div className="admin-users-head">
          <div><p className="admin-kicker">People</p><h2>Users</h2><p>{summary.pagination.total === 0 ? "No matching users" : `Showing ${summary.pagination.offset + 1}–${Math.min(summary.pagination.offset + summary.users.length, summary.pagination.total)} of ${summary.pagination.total}`}</p></div>
          <div className="admin-actions">
            <label className="admin-search"><span>Search users</span><input className="field" type="search" value={query} placeholder="Name, ID, group, or location" onChange={event => { setQuery(event.target.value); setOffset(0); }} /></label>
            <label><span>Users per page</span><select className="field admin-page-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setOffset(0); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <button className="btn" type="button" disabled={loading} onClick={() => void load(token, offset, query, pageSize, true)}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>

        {summary.users.length > 0 ? <div className="admin-user-list">{summary.users.map(user => <UserCard key={user.id} user={user} />)}</div> : <div className="admin-no-results"><h3>No users found</h3><p>Try a different name, ID, group, or location.</p>{query && <button className="btn ghost" type="button" onClick={() => { setQuery(""); setOffset(0); }}>Clear search</button>}</div>}

        <nav className="admin-pagination" aria-label="User pages">
          <button className="btn ghost" type="button" disabled={summary.pagination.offset <= 0 || loading} onClick={() => setOffset(Math.max(0, summary.pagination.offset - summary.pagination.limit))}>Previous</button>
          <span>Page <b>{currentPage}</b> of <b>{totalPages}</b></span>
          <button className="btn ghost" type="button" disabled={!summary.pagination.has_more || loading} onClick={() => setOffset(summary.pagination.offset + summary.pagination.limit)}>Next</button>
        </nav>
      </section>
    </div>}
  </main>;
}
