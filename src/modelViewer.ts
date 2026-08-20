import { useEffect, useState } from "react";

/**
 * <model-viewer> is ~1MB of JavaScript and it registers a custom element as a
 * side effect of being imported. Loading it up front pushed first paint past
 * two seconds on a mid-range phone, so it is fetched on demand instead.
 *
 * Every component that renders a <model-viewer> tag must await this first --
 * an unregistered custom element renders as an empty inline box, silently, with
 * no console error. That is exactly how the forest panda vanished when the
 * eager `import "@google/model-viewer"` was removed from main.tsx: Runner's own
 * dynamic import happened to register it, and anything that rendered before
 * Runner mounted got nothing.
 */
let load: Promise<unknown> | null = null;

export const loadModelViewer = () => {
  load ??= import("@google/model-viewer");
  return load;
};

/** Resolves once the tag is safe to render. */
export function useModelViewer(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadModelViewer().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
