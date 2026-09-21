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
import loadingScene from "../frontend/assets/loading.webp";

const loadApp = () => import("./App");
const loadSharedView = () => import("./components/SharedView");
const loadJoinLobby = () => import("./components/JoinLobby");
const loadAdminPanel = () => import("./components/AdminPanel");

const App = React.lazy(loadApp);
const SharedView = React.lazy(loadSharedView);
const JoinLobby = React.lazy(loadJoinLobby);
const AdminPanel = React.lazy(loadAdminPanel);

const params = new URLSearchParams(location.search);
const shareToken = params.get("share");
const joinToken = params.get("join");
const isAdminRoute = location.pathname === "/adminpanda";
const BOOT_MIN_MS = 350;
const BOOT_ASSETS = [
  loadingScene,
  "/assets/character_selection/character_selection-wide.jpg",
  "/assets/character_selection/character_selection.jpg",
  "/assets/logo.webp",
  "/assets/panda-sprite.webp",
  "/assets/koala-sprite.webp",
  "/assets/redpanda-sprite.webp",
  "/assets/forest-background.webp",
  "/assets/forest-bg-1.webp",
  "/assets/grass-left.webp",
  "/assets/grass-mid.webp",
  "/assets/grass-right.webp",
  "/assets/start-sign.webp",
  "/assets/coin.webp",
] as const;

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

const preloadImage = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const loadCurrentRoute = () => {
  if (isAdminRoute) return loadAdminPanel();
  if (shareToken) return loadSharedView();
  if (joinToken) return loadJoinLobby();
  return loadApp();
};

function BootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [loaded, setLoaded] = React.useState(0);
  const total = BOOT_ASSETS.length + 2;

  React.useEffect(() => {
    let live = true;
    const tick = () => {
      if (live) setLoaded((n) => Math.min(total, n + 1));
    };

    const fontReady =
      "fonts" in document
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();

    Promise.all([
      Promise.allSettled(BOOT_ASSETS.map((src) => preloadImage(src).then(tick))),
      loadCurrentRoute().then(tick).catch(tick),
      fontReady.then(tick),
      sleep(BOOT_MIN_MS),
    ]).then(() => {
      if (live) setReady(true);
    });

    return () => {
      live = false;
    };
  }, [total]);

  if (!ready) return <LoadingPage label="Loading game" progress={(loaded / total) * 100} />;
  return <>{children}</>;
}

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
  return (
    <BootGate>
      <React.Suspense fallback={<LoadingPage label="Loading run" />}>{view}</React.Suspense>
    </BootGate>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
