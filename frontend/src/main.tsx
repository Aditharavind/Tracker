import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import JoinLobby from "./components/JoinLobby";
import "@google/model-viewer";
import "./styles.css";

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
