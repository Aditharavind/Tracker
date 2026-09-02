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

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

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
