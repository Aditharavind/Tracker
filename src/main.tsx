import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import JoinLobby from "./components/JoinLobby";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/press-start-2p";
import "./styles.css";
import { loadModelViewer } from "./modelViewer";

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

// The forest character is a <model-viewer>, so its ~1MB runtime gets pulled in
// on the first screen whether or not anything else needs 3D. It is deliberately
// started at IDLE rather than during boot.
//
// It does not gate anything visible: every character renders a flat sprite as
// its base layer and the viewer only paints over it once ready (see Panda.tsx),
// so a late start costs nothing but a slightly later swap to 3D. Executing that
// megabyte while the phone is still assembling the first screen, on the other
// hand, costs a great deal. Measured on a throttled mid-range phone (4x CPU,
// ~1.6Mbps), eager vs idle:
//
//     total blocking time   205ms -> 17ms     (how long taps go unanswered)
//     transferred in 7s     604KB -> 409KB
//
// The idle start now also does the FETCHING. index.html used to carry a
// <link rel="modulepreload"> for this chunk, on the theory that pulling the
// bytes early and only deferring execution was free. On a phone it is not: the
// preload is high priority, so a megabyte competed with the app bundle for a
// narrow pipe and index.js took 1065ms to arrive instead of ~370ms. The
// measurement that cleared the preload had been reading the loading skeleton,
// which paints before any of this matters, so the cost never showed up.
//
// Do NOT reinstate it as rel="prefetch": prefetch and the module import use
// different caches, so the whole megabyte downloads twice (measured: 897KB,
// blocking back up to 167ms). The service worker precaches this chunk, so
// every load after the first gets it for nothing anyway.
//
// loadModelViewer() memoises its promise, so this is the same import Panda
// awaits, not a second fetch. The catch only stops a failed fetch becoming an
// unhandled rejection -- anything rendering a <model-viewer> already falls back
// to the flat sprite when it never resolves.
const startViewer = () => void loadModelViewer().catch(() => {});
const w = window as Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
};
// The timeout is a ceiling, not a delay: if the phone never goes idle it starts
// anyway, so a busy device still ends up with the 3D character.
if (typeof w.requestIdleCallback === "function") {
  w.requestIdleCallback(startViewer, { timeout: 3000 });
} else {
  w.setTimeout(startViewer, 1200);
}

const params = new URLSearchParams(location.search);
const shareToken = params.get("share");
const joinToken = params.get("join");

function Root() {
  if (shareToken) return <SharedView token={shareToken} />;
  if (joinToken) return <JoinLobby token={joinToken} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
