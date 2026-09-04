/**
 * A short-lived, in-process cache for read endpoints whose answer is safe to
 * reuse for a few seconds.
 *
 * Unlike rate limiting (ratelimit.js), this deliberately stays per-instance
 * rather than shared over Redis. The two have opposite failure shapes: a rate
 * limiter that can't see the whole fleet doesn't actually limit anything (that
 * was the bug it replaced), but a cache that can't see the whole fleet just
 * misses more often and falls back to computing fresh -- never wrong, only
 * sometimes not as fast as it could be. Adding a Redis round trip to every read
 * would trade a guaranteed win (the in-process hit) for a maybe-win (a shared
 * hit) at guaranteed extra latency, which is the wrong trade for a cache.
 *
 * It still matters at real scale: Vercel keeps a serverless instance warm
 * across many requests under sustained load, not one request each. A "family
 * board" whose five members all check in around the same few seconds, or one
 * account's own app polling itself after a reconnect, routinely lands on the
 * same warm instance -- and that is exactly the traffic this removes from the
 * database.
 */

const entries = new Map(); // key -> { value, expires }
const versions = new Map(); // groupId -> version number

/** Bound memory under sustained traffic instead of growing forever. */
const MAX_ENTRIES = 5000;

/** Cached value for `key`, or undefined on a miss or an expired entry. */
export function cacheGet(key) {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (Date.now() >= hit.expires) {
    entries.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs) {
  entries.set(key, { value, expires: Date.now() + ttlMs });
  if (entries.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of entries) if (now >= v.expires) entries.delete(k);
  }
}

/**
 * A group's current cache generation. Folding this into a cache key means
 * bumping it retires every cached entry for that group at once -- including
 * ones for query-param combinations (a different page, a different day) this
 * module never had to know about individually.
 */
export function groupVersion(groupId) {
  return versions.get(groupId) ?? 0;
}

/** Call after any write that could change what a group's board shows. */
export function bumpGroupVersion(groupId) {
  versions.set(groupId, (versions.get(groupId) ?? 0) + 1);
}

/**
 * Drop everything. Called whenever the backing store changes (see setStore in
 * store/index.js) -- a cached answer is only valid for the store that produced
 * it, so swapping stores without this would let one store's cached response
 * leak into a request now being served by a different one. In production the
 * store is set once at cold start, before any request, so this is a no-op
 * there; it matters for tests, which call setStore repeatedly to swap in a
 * fresh in-memory store per test.
 */
export function resetCache() {
  entries.clear();
  versions.clear();
}
