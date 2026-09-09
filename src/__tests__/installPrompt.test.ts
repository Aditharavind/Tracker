import { afterEach, describe, expect, it } from "vitest";
import { isIOS, isStandalone } from "../installPrompt";

/**
 * vitest here runs in Node, not jsdom (see vitest.config.ts -- only the game
 * logic uses vitest; DOM-driven behaviour throughout this codebase is
 * verified against a real browser instead, not a simulated one). window and
 * navigator are stubbed directly on globalThis for exactly these two calls,
 * matching how tests/cache.test.js already stubs global.fetch.
 *
 * The event-capture/prompt/userChoice orchestration in useInstallPrompt
 * itself is NOT re-tested here -- it was verified against a real, locally
 * served build of the actual app: a genuine beforeinstallprompt fired,
 * .install() called its real .prompt(), and the "already installed" state
 * correctly hid the whole section. These two functions are what remained
 * meaningfully unit-testable without introducing a DOM test environment
 * this project does not otherwise use.
 */

// Only the two calls isStandalone/isIOS actually make -- not the real DOM
// lib types (which globalThis already carries in full here, via tsconfig's
// "DOM" lib, so a stub this partial has to go through `unknown` rather than
// satisfy Window/Navigator's own hundred-plus other properties).
type StubWindow = { matchMedia?: (q: string) => { matches: boolean }; MSStream?: unknown };
type StubNavigator = { standalone?: boolean; userAgent?: string };
type GlobalSlot = "window" | "navigator";
// Property access, not the bare identifiers -- vitest runs this file under
// Node (see vitest.config.ts), where `window`/`navigator` are not real
// globals at all until a test defines them. tsconfig's DOM lib makes
// TypeScript believe they always exist (for the whole project, not just
// browser code), which would let a bare reference compile clean and then
// throw ReferenceError the moment the test actually runs.
const getGlobal = (slot: GlobalSlot): unknown => (globalThis as Record<string, unknown>)[slot];
// Plain assignment throws under newer Node, which now defines `navigator`
// itself as a getter-only global (no setter) -- redefine the property outright
// instead of writing through the accessor.
const setGlobal = (slot: GlobalSlot, value: unknown) => {
  Object.defineProperty(globalThis, slot, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
};

const original = { window: getGlobal("window"), navigator: getGlobal("navigator") };
afterEach(() => {
  setGlobal("window", original.window);
  setGlobal("navigator", original.navigator);
});

const stub = (opts: { matches?: boolean; standalone?: boolean; ua?: string; msStream?: boolean }) => {
  const win: StubWindow = {
    matchMedia: (q: string) => ({ matches: q === "(display-mode: standalone)" ? !!opts.matches : false }),
    ...(opts.msStream ? { MSStream: {} } : {}),
  };
  const nav: StubNavigator = { standalone: opts.standalone, userAgent: opts.ua ?? "" };
  setGlobal("window", win);
  setGlobal("navigator", nav);
};

describe("isStandalone", () => {
  it("true when display-mode: standalone matches", () => {
    stub({ matches: true });
    expect(isStandalone()).toBe(true);
  });

  it("true on iOS's own pre-standard navigator.standalone flag", () => {
    stub({ matches: false, standalone: true });
    expect(isStandalone()).toBe(true);
  });

  it("false when neither signal is set", () => {
    stub({ matches: false, standalone: false });
    expect(isStandalone()).toBe(false);
  });

  it("never throws, even if matchMedia itself blows up", () => {
    setGlobal("window", { matchMedia: () => { throw new Error("no display-mode support"); } });
    setGlobal("navigator", {});
    expect(() => isStandalone()).not.toThrow();
    expect(isStandalone()).toBe(false);
  });
});

describe("isIOS", () => {
  it("true for iPhone, iPad, and iPod user agents", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)",
    ]) {
      stub({ ua });
      expect(isIOS()).toBe(true);
    }
  });

  it("true for Chrome-on-iOS and Firefox-on-iOS -- same WebKit underneath, same lack of an install API", () => {
    stub({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0" });
    expect(isIOS()).toBe(true);
    stub({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/120.0" });
    expect(isIOS()).toBe(true);
  });

  it("false for Android and desktop", () => {
    stub({ ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120" });
    expect(isIOS()).toBe(false);
    stub({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120" });
    expect(isIOS()).toBe(false);
  });

  it("false on old IE's MSStream, which used to false-positive on the same UA substring trick", () => {
    stub({ ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", msStream: true });
    expect(isIOS()).toBe(false);
  });

  it("never throws, even with no navigator at all", () => {
    setGlobal("window", {});
    setGlobal("navigator", undefined);
    expect(() => isIOS()).not.toThrow();
    expect(isIOS()).toBe(false);
  });
});
