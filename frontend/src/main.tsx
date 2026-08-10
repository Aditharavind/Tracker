import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SharedView from "./components/SharedView";
import "@google/model-viewer";
import "./styles.css";

const shareToken = new URLSearchParams(location.search).get("share");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {shareToken ? <SharedView token={shareToken} /> : <App />}
  </React.StrictMode>
);
