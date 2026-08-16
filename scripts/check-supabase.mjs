/**
 * Verifies a Supabase project is ready: credentials work, every table exists,
 * and the core-task trigger fires. Run after pasting supabase/schema.sql in.
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
    const detail = await fn();
    console.log(`  ok    ${label}${detail ? ` (${detail})` : ""}`);
  } catch (err) {
    failed = true;
    console.log(`  FAIL  ${label}: ${err.message}`);
  }
};

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

console.log(`\nchecking ${url}\n`);

for (const table of ["users", "tasks", "completions", "day_notes"]) {
  await check(`table ${table}`, async () => {
    must(await db.from(table).select("*", { count: "exact", head: true }));
  });
}

const probe = `__healthcheck_${Date.now()}`;
await check("insert user + core-task trigger", async () => {
  const user = must(await db.from("users").insert({ name: probe }).select().single());
  const tasks = must(await db.from("tasks").select("*").eq("user_id", user.id));
  if (tasks.length !== 7) {
    must(await db.from("users").delete().eq("id", user.id));
    throw new Error(`trigger seeded ${tasks.length} tasks, expected 7 - is seed_core_tasks installed?`);
  }

  // unique constraint should make a double-tick a no-op
  const day = new Date().toISOString().slice(0, 10);
  const row = { user_id: user.id, task_id: tasks[0].id, day };
  must(await db.from("completions").insert(row));
  const dupe = await db.from("completions").insert(row);
  if (!dupe.error) {
    must(await db.from("users").delete().eq("id", user.id));
    throw new Error("duplicate completion was accepted - unique constraint missing");
  }

  must(await db.from("users").delete().eq("id", user.id));
  const orphans = must(await db.from("tasks").select("id").eq("user_id", user.id));
  if (orphans.length) throw new Error("delete did not cascade to tasks");
  return "7 tasks seeded, unique + cascade both hold";
});

console.log(failed ? "\nsomething is not set up right (see above)\n" : "\nall good - ready to deploy\n");
process.exit(failed ? 1 : 0);
