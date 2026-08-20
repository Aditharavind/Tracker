import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import JoinLobby from "./components/JoinLobby";
import { registerSW } from "virtual:pwa-register";
import "./styles.css";

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

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
