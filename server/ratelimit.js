/**
 * Request rate limiting.
 *
 * There are two problems with limiting inside a serverless function, and this
 * module is explicit about which of them it solves.
 *
 * The counter is per instance. Vercel runs as many copies of this function as
 * it likes, and they share no memory, so an in-process ceiling of N/min is
 * really N x (however many instances happen to be warm). Measured against the
 * deployed app: a single client sustained ~9,600 requests/minute from one
 * address against a configured ceiling of 600 without ever being refused,
 * because the load spread across warm instances. In-process limiting is a
 * backstop against one runaway client on one instance, and nothing more.
 *
 * For a real fleet-wide ceiling the count has to live somewhere shared. Set
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN and this module keeps it
 * in Redis instead, which every instance and region sees. It is off unless
 * those are configured, so nothing changes until you opt in.
 *
 * Reads and writes get separate budgets. A read flood is expensive; a write
 * flood is worse, because writes are unauthenticated (see requirePin in
 * app.js), hit the database harder, and leave rows behind. The write ceiling is
 * therefore much tighter than the read one, which can stay generous -- mobile
 * carriers and offices put thousands of real people behind one address.
 */

const WINDOW_MS = 60_000;
const WINDOW_SEC = 60;

/**
 * Never let the limiter become the slow part. If the shared store does not
 * answer quickly we fall through to the in-process count rather than making
 * every request wait on it.
 */
const REDIS_TIMEOUT_MS = 250;

/** Generous: this is sized to catch a runaway loop, not to apportion capacity. */
export const readMax = () => Number(process.env.RATE_LIMIT_PER_MIN) || 600;

/** Tight: writes are unauthenticated and durable, so they are worth rationing. */
export const writeMax = () =>
  Number(process.env.RATE_LIMIT_WRITES_PER_MIN) || 120;

const redisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
};

/**
 * Count one hit in Redis and return the running total, or null if the shared
 * store is unavailable for any reason.
 *
 * INCR creates the key at 1; EXPIRE ... NX sets the TTL only on that first
 * write, which makes it a fixed window rather than one that slides forward
 * with every request and never expires.
 *
 * Every failure path returns null -- fail OPEN. A rate limiter that takes the
 * site down when its own backend hiccups is worse than the abuse it prevents.
 */
async function redisHit(cfg, key) {
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(WINDOW_SEC), "NX"],
      ]),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const n = Number(body?.[0]?.result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * One limiter per app instance, so each cold start -- and each test -- begins
 * with a clean budget instead of inheriting the previous one.
 */
export function createRateLimit(clientIp) {
  const hits = new Map();
  // Read per instance rather than at import, so a deployment can retune these
  // without a rebuild, and so tests can set a small ceiling.
  const maxRead = readMax();
  const maxWrite = writeMax();
  const cfg = redisConfig();

  /** In-process fixed window. Returns the running count for this key. */
  const localHit = (key, now) => {
    const entry = hits.get(key);
    if (!entry || now >= entry.reset) {
      hits.set(key, { count: 1, reset: now + WINDOW_MS });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  };

  const resetAt = (key, now) => hits.get(key)?.reset ?? now + WINDOW_MS;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = clientIp(req);
    const isWrite = req.method !== "GET" && req.method !== "HEAD";
    const max = isWrite ? maxWrite : maxRead;
    const key = `rl:${isWrite ? "w" : "r"}:${ip}`;

    const refuse = () => {
      const retry = Math.max(1, Math.ceil((resetAt(key, now) - now) / 1000));
      res.set("Retry-After", String(retry));
      res.status(429).json({ error: "too many requests -- slow down" });
    };

    // Sweep on write rather than on a timer: an interval would hold a
    // serverless instance open, and an unbounded Map is the leak this guards.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
    }

    // Always count locally, so the backstop still holds if Redis is missing,
    // slow or broken. The shared count, when we can get one, is authoritative
    // because it sees the whole fleet rather than this instance's share.
    const local = localHit(key, now);

    if (!cfg) {
      if (local > max) return refuse();
      return next();
    }

    redisHit(cfg, key).then((shared) => {
      const count = shared ?? local;
      if (count > max) return refuse();
      next();
    });
  };
}
