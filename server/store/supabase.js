/**
 * Supabase-backed store. Runs server-side only and uses the *secret* /
 * service-role key, which bypasses RLS -- never import this from src/.
 *
 * Talks to PostgREST directly rather than through supabase-js: we only ever
 * make table queries, and the full client drags in a Realtime socket that
 * needs a WebSocket global Node 20 doesn't have. This is the same query
 * builder, minus the auth/realtime/storage machinery and its cold-start cost.
 */
import { PostgrestClient } from "@supabase/postgrest-js";
import { newShareToken } from "../security.js";

const PAGE = 1000; // PostgREST's default cap -- it truncates silently past this

/**
 * Reads every row of a query, a page at a time.
 *
 * Without this, a user with more than 1000 completions gets a silently
 * truncated history and their streak, XP and trophies all come out wrong.
 * That happens after ~125 days of use with the seven core tasks, sooner if
 * they add bonus habits, because we deliberately keep lifetime history.
 */
async function readAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw Object.assign(new Error(error.message), { supabase: error });
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

const unwrap = ({ data, error }) => {
  if (error) throw Object.assign(new Error(error.message), { supabase: error });
  return data;
};

export function createSupabaseStore({ url, key }) {
  const db = new PostgrestClient(`${url.replace(/\/$/, "")}/rest/v1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  return {
    kind: "supabase",

    async createGroup() {
      return unwrap(
        await db.from("groups").insert({ invite_token: newShareToken() }).select().single()
      );
    },

    async getGroup(id) {
      return unwrap(await db.from("groups").select("*").eq("id", id).maybeSingle());
    },

    async getGroupByInviteToken(token) {
      return unwrap(
        await db.from("groups").select("*").eq("invite_token", token).maybeSingle()
      );
    },

    async listUsers() {
      return unwrap(await db.from("users").select("*").order("id"));
    },

    async listUsersInGroup(groupId) {
      return unwrap(await db.from("users").select("*").eq("group_id", groupId).order("id"));
    },

    async getUserByShareToken(token) {
      return unwrap(
        await db.from("users").select("*").eq("share_token", token).maybeSingle()
      );
    },

    /** Most recently seen user from this address -- see /session/suggest. */
    async getUserByLastIp(ip) {
      const rows = unwrap(
        await db
          .from("users")
          .select("*")
          .eq("last_ip", ip)
          .order("last_seen_at", { ascending: false, nullsFirst: false })
          .limit(1)
      );
      return rows[0] ?? null;
    },

    async getUser(id) {
      return unwrap(await db.from("users").select("*").eq("id", id).maybeSingle());
    },

    async listUsersByName(name) {
      return unwrap(await db.from("users").select("*").ilike("name", name));
    },

    async getUserByNameInGroup(groupId, name) {
      return unwrap(
        await db.from("users").select("*").eq("group_id", groupId).ilike("name", name).maybeSingle()
      );
    },

    async createUser(row) {
      // the seed_core_tasks trigger fills in the seven rules for us
      return unwrap(await db.from("users").insert(row).select().single());
    },

    async updateUser(id, patch) {
      return unwrap(await db.from("users").update(patch).eq("id", id).select().single());
    },

    async listTasks(userId) {
      return unwrap(
        await db
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("archived", false)
          .order("sort")
          .order("id")
      );
    },

    async getTask(id) {
      return unwrap(await db.from("tasks").select("*").eq("id", id).maybeSingle());
    },

    async createTask(task) {
      return unwrap(await db.from("tasks").insert(task).select().single());
    },

    async updateTask(id, patch) {
      return unwrap(await db.from("tasks").update(patch).eq("id", id).select().single());
    },

    async archiveTask(id) {
      unwrap(await db.from("tasks").update({ archived: true }).eq("id", id).select());
    },

    async listCompletions(userId) {
      return readAll(() => db.from("completions").select("task_id, day").eq("user_id", userId));
    },

    /**
     * Batched variants for /board, which needs every member at once. Done one
     * user at a time it was two round trips per member -- a six-person board
     * meant twelve sequential-ish queries, on every board load and after every
     * tick. These make it two, whatever the group size. Both carry user_id so
     * the caller can group the rows back up.
     */
    async listTasksForUsers(userIds) {
      if (!userIds.length) return [];
      return readAll(() =>
        db.from("tasks").select("*").in("user_id", userIds).eq("archived", false).order("sort").order("id")
      );
    },

    async listCompletionsForUsers(userIds) {
      if (!userIds.length) return [];
      return readAll(() =>
        db.from("completions").select("user_id, task_id, day").in("user_id", userIds)
      );
    },

    async listCompletionsForDay(userId, day) {
      return unwrap(
        await db.from("completions").select("task_id, day").eq("user_id", userId).eq("day", day)
      );
    },

    async addCompletion(row) {
      // the unique constraint makes a re-tick a no-op instead of a duplicate
      return unwrap(
        await db
          .from("completions")
          .upsert(row, { onConflict: "user_id,task_id,day", ignoreDuplicates: true })
          .select()
      );
    },

    async removeCompletion({ user_id, task_id, day }) {
      unwrap(
        await db
          .from("completions")
          .delete()
          .eq("user_id", user_id)
          .eq("task_id", task_id)
          .eq("day", day)
          .select()
      );
    },

    async getNote(userId, day) {
      return unwrap(
        await db
          .from("day_notes")
          .select("*")
          .eq("user_id", userId)
          .eq("day", day)
          .maybeSingle()
      );
    },

    async upsertNote(userId, day, text) {
      return unwrap(
        await db
          .from("day_notes")
          .upsert({ user_id: userId, day, text }, { onConflict: "user_id,day" })
          .select()
          .single()
      );
    },
  };
}
