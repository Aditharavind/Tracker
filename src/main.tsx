import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import SharedView from "./components/SharedView";
import "./styles.css";

// autoUpdate: a new deploy is picked up on the next launch.
registerSW({ immediate: true });

const shareToken = new URLSearchParams(location.search).get("share");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {shareToken ? <SharedView token={shareToken} /> : <App />}
  </React.StrictMode>
);
