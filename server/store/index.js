import { createMemoryStore } from "./memory.js";
import { createSupabaseStore } from "./supabase.js";
import { resetCache } from "../cache.js";

let cached = null;

/**
 * Supabase when credentials are present, otherwise an in-memory store so the
 * app still runs offline. On Vercel the env vars are always set, so this only
 * ever falls back during local development.
 *
 * The client is cached across invocations because a warm serverless function
 * reuses its module scope between requests.
 */
export function getStore() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    cached = createSupabaseStore({ url, key });
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in the Vercel project settings"
      );
    }
    console.warn("[75hard] no Supabase credentials found - using in-memory store");
    cached = createMemoryStore();
  }
  return cached;
}

/**
 * Tests inject their own store. Also resets the board cache -- see
 * resetCache's own comment for why a store swap has to drop it.
 */
export function setStore(store) {
  cached = store;
  resetCache();
}
