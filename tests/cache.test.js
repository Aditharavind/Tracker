/**
 * cache.js's in-process tier is exercised indirectly by scale.test.js's board
 * tests. What those cannot prove is the whole reason the Redis tier exists:
 * that two *different* serverless instances -- which share no memory -- still
 * see each other's writes. Node's module cache makes that hard to simulate
 * with a single import, since every test in this file would otherwise share
 * the same `entries`/`versions` Maps. Importing the module twice with a
 * distinguishing query string gets two independent instances of that state,
 * exactly as two warm Lambdas would have, while a stubbed `fetch` stands in
 * for Upstash's REST API so no network or real Redis is needed.
 */
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

const originalFetch = global.fetch;

/** A tiny in-memory Upstash pipeline responder: enough of GET/SET/INCR to test against. */
function fakeUpstash() {
  const store = new Map();
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(url);
    const commands = JSON.parse(init.body);
    const results = commands.map(([cmd, key, ...rest]) => {
      if (cmd === "GET") return { result: store.has(key) ? store.get(key) : null };
      if (cmd === "SET") {
        store.set(key, String(rest[0]));
        return { result: "OK" };
      }
      if (cmd === "INCR") {
        const next = (Number(store.get(key)) || 0) + 1;
        store.set(key, String(next));
        return { result: next };
      }
      return { result: null };
    });
    return { ok: true, json: async () => results };
  };
  return { store, calls };
}

let envBackup;
beforeEach(() => {
  envBackup = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  if (envBackup.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = envBackup.url;
  if (envBackup.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = envBackup.token;
});

/** A fresh module instance -- see the file comment for why. */
const freshCache = () => import(`../server/cache.js?instance=${Math.random()}`);

test("without Redis configured, two instances know nothing of each other -- today's baseline", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const a = await freshCache();
  const b = await freshCache();

  a.cacheSet("k", { hello: "from-a" }, 5000);
  assert.equal(await b.cacheGet("k"), undefined, "instance B has never heard of this write");

  a.bumpGroupVersion(1);
  assert.equal(await a.groupVersion(1), 1);
  assert.equal(await b.groupVersion(1), 0, "instance B's own writes never happened for it");
});

test("with Redis configured, a write on one instance is visible on another", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  fakeUpstash();
  const a = await freshCache();
  const b = await freshCache();

  a.cacheSet("board:1:0:2026-09-04:50:0", { members: ["a"] }, 5000);
  const seenByB = await b.cacheGet("board:1:0:2026-09-04:50:0");
  assert.deepEqual(seenByB, { members: ["a"] }, "B reads what A wrote, through the shared backend");

  a.bumpGroupVersion(7);
  assert.equal(await b.groupVersion(7), 1, "B sees A's version bump without ever bumping it itself");
});

test("groupVersion never goes backwards from what an instance already knows locally", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  fakeUpstash();
  const a = await freshCache();

  a.bumpGroupVersion(3);
  a.bumpGroupVersion(3);
  a.bumpGroupVersion(3); // local = 3, and each bump also fires an INCR at the shared store
  await new Promise((r) => setTimeout(r, 10)); // let the fire-and-forget INCRs land
  const v = await a.groupVersion(3);
  assert.ok(v >= 3, "the higher of local and shared wins, never the lower");
});

test("a broken or unreachable Redis fails open rather than breaking the read", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  global.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  const a = await freshCache();

  // Neither call throws -- a caching layer that can fail a request when its
  // own backend hiccups would be worse than having no cache at all.
  await assert.doesNotReject(() => a.groupVersion(1));
  await assert.doesNotReject(() => a.cacheGet("anything"));
  assert.equal(await a.groupVersion(1), 0, "falls back to the local count");
  assert.equal(await a.cacheGet("anything"), undefined, "falls back to a miss");

  // The local tier still works even while Redis is unreachable.
  a.cacheSet("k", "v", 5000);
  assert.equal(await a.cacheGet("k"), "v");
});

test("a slow Redis is abandoned rather than stalling the request", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  global.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      // Never resolves on its own -- only AbortSignal.timeout inside cache.js
      // can end this. If that wiring were missing this test would hang.
      // Polled rather than event-listener-based: it does not depend on
      // exactly when the signal is attached relative to this call.
      const check = setInterval(() => {
        if (init.signal?.aborted) {
          clearInterval(check);
          reject(new DOMException("aborted", "AbortError"));
        }
      }, 10);
    });
  const a = await freshCache();

  const start = Date.now();
  const result = await a.groupVersion(1);
  assert.ok(Date.now() - start < 2000, "gave up well under a couple of seconds");
  assert.equal(result, 0);
});
