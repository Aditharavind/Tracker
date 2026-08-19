/**
 * Verifies a Supabase project is ready: credentials work, every table
 * exists, and the core-task trigger fires.
 *
 *   npm run check
 *
 * Creates a throwaway user, asserts the trigger seeded seven tasks, then
 * deletes it -- the cascade cleans up everything it touched.
 */
import { PostgrestClient } from "@supabase/postgrest-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY.");
  console.error("Put them in .env.local (see .env.example) or export them.");
  process.exit(1);
}
if (key.startsWith("sb_publishable_") || key.includes("anon")) {
  console.error("That looks like the publishable/anon key. The server needs the SECRET key:");
  console.error("Supabase dashboard -> Project Settings -> API keys -> secret");
  process.exit(1);
}

const db = new PostgrestClient(`${url.replace(/\/$/, "")}/rest/v1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
let failed = false;

const check = async (label, fn) => {
  try {
    await fn();
    console.log(`ok    ${label}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL  ${label}: ${e.message}`);
  }
};

for (const table of ["groups", "users", "tasks", "completions", "day_notes"]) {
  await check(`table "${table}" exists`, async () => {
    const { error } = await db.from(table).select("id", { head: true, count: "exact" });
    if (error) throw new Error(error.message);
  });
}

let groupId;
let userId;

await check("insert a group", async () => {
  const { data, error } = await db.from("groups").insert({ invite_token: "check-" + Date.now() }).select().single();
  if (error) throw new Error(error.message);
  groupId = data.id;
});

await check("insert a user seeds seven core tasks via trigger", async () => {
  const { data, error } = await db
    .from("users")
    .insert({ name: "check-" + Date.now(), group_id: groupId, share_token: "check-" + Date.now() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  userId = data.id;

  const { data: tasks, error: taskErr } = await db.from("tasks").select("id").eq("user_id", userId);
  if (taskErr) throw new Error(taskErr.message);
  if (tasks.length !== 7) throw new Error(`expected 7 seeded tasks, got ${tasks.length}`);
});

await check("clean up (group cascade deletes the user + tasks)", async () => {
  if (groupId == null) return;
  const { error } = await db.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
});

if (failed) {
  console.error("\nSupabase project is not ready -- see failures above.");
  process.exit(1);
}
console.log("\nSupabase project looks good.");
