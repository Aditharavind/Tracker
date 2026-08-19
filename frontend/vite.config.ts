import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Talk to FastAPI through the same origin so there is no CORS in dev and
    // the exact same fetch paths work against the built bundle in prod.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
    // This repo runs from WSL against a drvfs-mounted Windows drive
    // (E:\...), and drvfs does not reliably surface inotify events for
    // edits made from the Windows side -- Vite's default watcher then just
    // never notices a file changed, silently serving stale modules with no
    // error. Polling stats every file instead of waiting for a filesystem
    // event sidesteps that entirely, at the cost of a bit of CPU.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
