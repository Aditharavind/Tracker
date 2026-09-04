/**
 * A short-lived cache for read endpoints whose answer is safe to reuse for a
 * few seconds, plus the per-group version counter that invalidates them.
 *
 * Two tiers. An in-process Map is always on and costs nothing -- it is a
 * cache hit for a second request that lands on the SAME warm serverless
 * instance as the first. Measured against the deployed app, that turned out
 * to be rarer than expected: a burst of concurrent /board requests mostly hit
 * distinct instances rather than piling onto one, so the in-process tier alone
 * produced close to no hits at the traffic level this app sees today. It
 * should still pay off as real sustained load grows -- a busier fleet reuses
 * each warm instance far more before adding another one -- but it is not
 * something this size of app can rely on right now.
 *
 * For a hit that does not depend on which instance answers, set
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN -- the same pair
 * ratelimit.js already reads, so turning them on buys real fleet-wide rate
 * limiting and real fleet-wide board caching in the same step. Every Redis
 * call is fail-open on any error or timeout: a cache that could make a
 * request slower or fail when its own backend hiccups would be worse than no
 * cache at all, so a Redis outage just degrades this back to the in-process
 * tier rather than surfacing anywhere.
 */

const entries = new Map(); // key -> { value, expires }
const versions = new Map(); // groupId -> version number

/** Bound memory under sustained traffic instead of growing forever. */
const MAX_ENTRIES = 5000;

const REDIS_TIMEOUT_MS = 250;

const redisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
};

/** One Redis command via the pipeline endpoint. Returns null on any failure. */
async function redisCommand(cfg, command) {
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([command]),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.[0]?.result ?? null;
  } catch {
    return null;
  }
}

function localGet(key) {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (Date.now() >= hit.expires) {
    entries.delete(key);
    return undefined;
  }
  return hit.value;
}

function localSet(key, value, ttlMs) {
  entries.set(key, { value, expires: Date.now() + ttlMs });
  if (entries.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of entries) if (now >= v.expires) entries.delete(k);
  }
}

/**
 * Cached value for `key`, or undefined on a miss or an expired entry.
 *
 * Checks the free, instant local tier first. Only reaches for Redis -- one
 * round trip -- on a local miss, and only when it is configured, so this costs
 * exactly what it always cost when Redis is not set up.
 */
export async function cacheGet(key) {
  const local = localGet(key);
  if (local !== undefined) return local;

  const cfg = redisConfig();
  if (!cfg) return undefined;

  const raw = await redisCommand(cfg, ["GET", key]);
  if (raw == null) return undefined;
  try {
    const value = JSON.parse(raw);
    // Backfill the local tier so a third near-simultaneous request on THIS
    // instance does not need Redis either. The TTL here is a short, fixed
    // ceiling rather than whatever is left of the original one -- Redis does
    // not hand that back, and a short backfill is the safe side to round to.
    localSet(key, value, 2000);
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Stores `value` for `ttlMs`. Always writes the local tier synchronously.
 * The Redis write, when configured, is fire-and-forget -- the caller (a read
 * handler about to respond) should never wait on it.
 */
export function cacheSet(key, value, ttlMs) {
  localSet(key, value, ttlMs);
  const cfg = redisConfig();
  if (!cfg) return;
  redisCommand(cfg, ["SET", key, JSON.stringify(value), "PX", String(ttlMs)]).catch(() => {});
}

/**
 * A group's current cache generation, folded into read cache keys so bumping
 * it retires every cached entry for that group at once -- including query-
 * param combinations (a different page, a different day) this module never
 * has to know about individually.
 *
 * Takes the higher of the local and shared counters. A stale shared read
 * (Redis down, or this instance's own bump has not landed there yet) must
 * never read as OLDER than what this instance already knows, or a write this
 * instance just made could stop invalidating its own cache.
 */
export async function groupVersion(groupId) {
  const local = versions.get(groupId) ?? 0;
  const cfg = redisConfig();
  if (!cfg) return local;

  const raw = await redisCommand(cfg, ["GET", `boardver:${groupId}`]);
  const shared = Number(raw);
  return Number.isFinite(shared) ? Math.max(local, shared) : local;
}

/**
 * Call after any write that could change what a group's board shows. Bumps
 * the local counter synchronously -- this instance's own cache is correct the
 * instant the write returns, regardless of Redis. The shared counter, when
 * configured, is fire-and-forget: a write should never be slowed down by a
 * caching side effect, and the in-process TTL ceiling bounds how stale another
 * instance's view can get even if this INCR is still in flight.
 */
export function bumpGroupVersion(groupId) {
  versions.set(groupId, (versions.get(groupId) ?? 0) + 1);
  const cfg = redisConfig();
  if (!cfg) return;
  redisCommand(cfg, ["INCR", `boardver:${groupId}`]).catch(() => {});
}

/**
 * Drop the local tier. Called whenever the backing store changes (see
 * setStore in store/index.js) -- a cached answer is only valid for the store
 * that produced it, so swapping stores without this would let one store's
 * cached response leak into a request now served by a different one. In
 * production the store is set once at cold start, before any request, so
 * this is a no-op there; it matters for tests, which call setStore repeatedly
 * to swap in a fresh in-memory store per test.
 *
 * Deliberately does not touch Redis: tests never configure it (redisConfig()
 * returns null without the env vars), so there is nothing there to clear, and
 * a real deployment should never call this mid-flight in the first place.
 */
export function resetCache() {
  entries.clear();
  versions.clear();
}
