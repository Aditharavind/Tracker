import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
// The interface is English-only. Loading every Cyrillic, Greek, and extended
// font subset added several files to every PWA install without changing what
// users see.
import "@fontsource/press-start-2p/latin-400.css";
import "./styles.css";
import "./world-theme.css";
import LoadingPage from "./components/LoadingPage";

const App = React.lazy(() => import("./App"));
const SharedView = React.lazy(() => import("./components/SharedView"));
const JoinLobby = React.lazy(() => import("./components/JoinLobby"));
const AdminPanel = React.lazy(() => import("./components/AdminPanel"));

const params = new URLSearchParams(location.search);
const shareToken = params.get("share");
const joinToken = params.get("join");
const isAdminRoute = location.pathname === "/adminpanda";

const w = window as Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
};

const runWhenIdle = (task: () => void, timeout: number) => {
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(task, { timeout });
  } else {
    w.setTimeout(task, Math.min(timeout, 1200));
  }
};

// autoUpdate: a new deploy is picked up on the next launch. Registration is
// delayed until after load/idle so the service worker's install fetches do not
// compete with the first screen.
const registerAppServiceWorker = () => runWhenIdle(() => registerSW({ immediate: false }), 2500);
if (document.readyState === "complete") {
  registerAppServiceWorker();
} else {
  window.addEventListener("load", registerAppServiceWorker, { once: true });
}

// The 1MB model-viewer runtime now loads only when a component actually opens
// a 3D preview. Every such component has a sprite fallback, so eagerly fetching
// it here spent bandwidth and main-thread time without improving first paint.

function Root() {
  const view =
    isAdminRoute ? (
      <AdminPanel />
    ) : shareToken ? (
      <SharedView token={shareToken} />
    ) : joinToken ? (
      <JoinLobby token={joinToken} />
    ) : (
      <App />
    );
  return <React.Suspense fallback={<LoadingPage label="Loading run" />}>{view}</React.Suspense>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
