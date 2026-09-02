import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import JoinLobby from "./components/JoinLobby";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/press-start-2p";
import "./styles.css";
import { CharBlink } from "./components/forest/Panda";
import { CHARACTER_SPRITE } from "./game/characters";
import { loadModelViewer } from "./modelViewer";

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

// The forest panda is a <model-viewer>, so its ~1MB runtime is on the critical
// path of the first screen whether or not anything else needs 3D. Left to
// Panda's own effect, the fetch could not even begin until React had mounted
// and run an effect -- pure dead time on a phone. Starting it here overlaps it
// with rendering instead. index.html also carries a <link rel="modulepreload">
// for the same chunk (see preloadModelViewer in vite.config.ts), so this is
// usually already in flight or served straight from cache by the time it runs.
//
// loadModelViewer() memoises its promise, so this is the same import Panda
// awaits, not a second fetch. The catch is only here to stop a failed fetch
// becoming an unhandled rejection at boot -- the components that render a
// <model-viewer> already fall back to the flat sprite when it never resolves.
loadModelViewer().catch(() => {});

const params = new URLSearchParams(location.search);
const shareToken = params.get("share");
const joinToken = params.get("join");

function BlinkProbe() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#223", display: "flex", gap: 18, alignItems: "center", justifyContent: "center" }}>
      {(["panda", "koala", "redpanda"] as const).map((c) => (
        <div key={c} style={{ position: "relative", width: 200, height: 200, outline: "1px solid #0f0" }}>
          <img src={CHARACTER_SPRITE[c]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
          <CharBlink character={c} />
        </div>
      ))}
    </div>
  );
}

function Root() {
  if (params.has("__b")) return <BlinkProbe />;
  if (shareToken) return <SharedView token={shareToken} />;
  if (joinToken) return <JoinLobby token={joinToken} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
