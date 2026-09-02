/**
 * In-memory store. Used by the test suite and by `npm run dev` when no
 * Supabase credentials are configured, so you can work on the UI offline.
 * Data lives for the life of the process and then disappears.
 *
 * Mirrors the Supabase behaviour exactly, including the trigger that seeds the
 * seven core tasks whenever a user is inserted.
 */
import { CORE_TASKS } from "../core-tasks.js";
import { newShareToken } from "../security.js";

export function createMemoryStore() {
  const groups = [];
  const users = [];
  const tasks = [];
  const completions = [];
  const notes = [];
  const seq = { group: 0, user: 0, task: 0, completion: 0, note: 0 };

  const clone = (row) => (row ? { ...row } : null);

  return {
    kind: "memory",

    async health() {
      return {
        ok: true,
        users: "ok",
        restarted_at: "ok",
        timezone: "ok",
        dash: "ok",
        rows: users.length,
      };
    },

    /** Raise a user's Forest Dash bests; never lowers them. */
    async submitDashScore(userId, coins, dist) {
      const user = users.find((u) => u.id === Number(userId));
      if (!user) return null;
      user.dash_best_coins = Math.max(user.dash_best_coins ?? 0, Math.trunc(coins) || 0);
      user.dash_best_dist = Math.max(user.dash_best_dist ?? 0, Math.trunc(dist) || 0);
      return clone(user);
    },

    /** Global Forest Dash leaderboard -- top players by coins, then distance. */
    async topDashScores(limit) {
      return users
        .filter((u) => (u.dash_best_coins ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.dash_best_coins ?? 0) - (a.dash_best_coins ?? 0) ||
            (b.dash_best_dist ?? 0) - (a.dash_best_dist ?? 0)
        )
        .slice(0, limit)
        .map((u) => ({
          name: u.name,
          color: u.color,
          coins: u.dash_best_coins ?? 0,
          distance: u.dash_best_dist ?? 0,
        }));
    },

    async createGroup() {
      const group = { id: (seq.group += 1), name: "My board", invite_token: newShareToken() };
      groups.push(group);
      return clone(group);
    },

    async getGroup(id) {
      return clone(groups.find((g) => g.id === Number(id)));
    },

    async getGroupByInviteToken(token) {
      return clone(groups.find((g) => g.invite_token === token));
    },

    async listUsers() {
      return users.map(clone).sort((a, b) => a.id - b.id);
    },

    async listUsersInGroup(groupId, page) {
      const all = users
        .filter((u) => u.group_id === Number(groupId))
        .sort((a, b) => a.id - b.id);
      const slice = page ? all.slice(page.offset, page.offset + page.limit) : all;
      return slice.map(clone);
    },

    async countUsersInGroup(groupId) {
      return users.filter((u) => u.group_id === Number(groupId)).length;
    },

    /** Everyone signed up, across every board -- see the Supabase version. */
    async countAllUsers() {
      return users.length;
    },

    async getUserByShareToken(token) {
      return clone(users.find((u) => u.share_token === token));
    },

    /** Most recently seen user from this address -- see /session/suggest. */
    async getUserByLastIp(ip) {
      const seen = users
        .filter((u) => u.last_ip === ip && u.last_seen_at)
        .sort((a, b) => String(b.last_seen_at).localeCompare(String(a.last_seen_at)));
      return clone(seen[0]);
    },

    async getUser(id) {
      return clone(users.find((u) => u.id === Number(id)));
    },

    async listUsersByName(name) {
      return users.filter((u) => u.name.toLowerCase() === name.toLowerCase()).map(clone);
    },

    async getUserByNameInGroup(groupId, name) {
      return clone(
        users.find(
          (u) => u.group_id === Number(groupId) && u.name.toLowerCase() === name.toLowerCase()
        )
      );
    },

    async createUser({
      name,
      color,
      start_date,
      pin_hash,
      wake_time,
      timezone,
      group_id,
      share_token,
    }) {
      const user = {
        id: (seq.user += 1),
        name,
        color,
        start_date,
        restarted_at: null,
        pin_hash: pin_hash ?? null,
        wake_time: wake_time ?? null,
        timezone: timezone ?? null,
        dash_best_coins: 0,
        dash_best_dist: 0,
        group_id: group_id ?? null,
        share_token: share_token ?? null,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      // mirrors seed_core_tasks_on_user
      CORE_TASKS.forEach(([title, emoji], i) => {
        tasks.push({
          id: (seq.task += 1),
          user_id: user.id,
          title,
          emoji,
          is_core: true,
          sort: i,
          archived: false,
          locked: false,
          reps_target: null,
        });
      });
      return clone(user);
    },

    async updateUser(id, patch) {
      const user = users.find((u) => u.id === Number(id));
      if (user) Object.assign(user, patch);
      return clone(user);
    },

    async listTasks(userId) {
      return tasks
        .filter((t) => t.user_id === Number(userId) && !t.archived)
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map(clone);
    },

    async getTask(id) {
      return clone(tasks.find((t) => t.id === Number(id)));
    },

    async createTask({ user_id, title, emoji, is_core, sort, locked, reps_target }) {
      const task = {
        id: (seq.task += 1),
        user_id: Number(user_id),
        title,
        emoji,
        is_core,
        sort,
        archived: false,
        locked: locked ?? false,
        reps_target: reps_target ?? null,
      };
      tasks.push(task);
      return clone(task);
    },

    async updateTask(id, patch) {
      const task = tasks.find((t) => t.id === Number(id));
      if (task) Object.assign(task, patch);
      return clone(task);
    },

    async archiveTask(id) {
      const task = tasks.find((t) => t.id === Number(id));
      if (task) task.archived = true;
    },

    async listCompletions(userId) {
      return completions.filter((c) => c.user_id === Number(userId)).map(clone);
    },

    /** Batched variants for /board -- see the Supabase store for why. */
    async listTasksForUsers(userIds) {
      const ids = new Set(userIds.map(Number));
      return tasks
        .filter((t) => ids.has(Number(t.user_id)) && !t.archived)
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map(clone);
    },

    async listCompletionsForUsers(userIds) {
      const ids = new Set(userIds.map(Number));
      return completions.filter((c) => ids.has(Number(c.user_id))).map(clone);
    },

    async listCompletionsForDay(userId, day) {
      return completions
        .filter((c) => c.user_id === Number(userId) && c.day === day)
        .map(clone);
    },

    async addCompletion({ user_id, task_id, day }) {
      const dup = completions.find(
        (c) => c.user_id === Number(user_id) && c.task_id === Number(task_id) && c.day === day
      );
      if (dup) return clone(dup);
      const row = {
        id: (seq.completion += 1),
        user_id: Number(user_id),
        task_id: Number(task_id),
        day,
      };
      completions.push(row);
      return clone(row);
    },

    async removeCompletion({ user_id, task_id, day }) {
      const i = completions.findIndex(
        (c) => c.user_id === Number(user_id) && c.task_id === Number(task_id) && c.day === day
      );
      if (i >= 0) completions.splice(i, 1);
    },

    /**
     * Wipe every completion a user has on or after `fromDay` (ISO dates sort
     * lexically, so a string compare is the right one). The "start over from
     * today" button leans on this so the fresh run really begins with an
     * untouched day 1 -- moving `restarted_at` alone left today's ticks in
     * place, which read as "the reset did nothing".
     */
    async clearCompletionsFrom(userId, fromDay) {
      for (let i = completions.length - 1; i >= 0; i -= 1) {
        const c = completions[i];
        if (c.user_id === Number(userId) && c.day >= fromDay) completions.splice(i, 1);
      }
    },

    async getNote(userId, day) {
      return clone(notes.find((n) => n.user_id === Number(userId) && n.day === day));
    },

    async upsertNote(userId, day, text) {
      const existing = notes.find((n) => n.user_id === Number(userId) && n.day === day);
      if (existing) {
        existing.text = text;
        return clone(existing);
      }
      const row = { id: (seq.note += 1), user_id: Number(userId), day, text };
      notes.push(row);
      return clone(row);
    },
  };
}
