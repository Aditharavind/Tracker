import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * <model-viewer> is ~1MB and is reached through a dynamic import inside
 * Panda.tsx, which sits on the first screen. That import is only discovered
 * after index.js has downloaded, parsed, mounted React and run an effect --
 * four serial steps before the largest asset on the page even starts loading.
 *
 * This emits a <link rel="modulepreload"> for that chunk into index.html so the
 * browser starts it while it is still parsing the HTML, in parallel with the
 * app bundle rather than after it. The href is read out of the real bundle, so
 * it always tracks the content hash instead of being pinned to a stale name.
 *
 * It goes at the END of <head> (injectTo: "head"), after the stylesheet, so the
 * render-blocking CSS still wins the race for bandwidth.
 */
function preloadModelViewer() {
  return {
    name: "preload-model-viewer",
    apply: "build" as const,
    enforce: "post" as const,
    transformIndexHtml(_html: string, ctx: { bundle?: Record<string, unknown> }) {
      const file = Object.keys(ctx.bundle ?? {}).find((f) =>
        /(^|\/)model-viewer-[^/]*\.js$/.test(f)
      );
      if (!file) return;
      return [
        {
          // `crossorigin` is not optional here. Module scripts are always
          // fetched in CORS mode, and a preload whose mode does not match the
          // real request is discarded and fetched again -- which would download
          // the 1MB chunk twice and be worse than not preloading at all. Vite
          // marks its own entry script and preload links the same way.
          tag: "link",
          attrs: { rel: "modulepreload", href: `/${file}`, crossorigin: true },
          injectTo: "head" as const,
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadModelViewer(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "75 Hard",
        short_name: "75 Hard",
        description: "A shared daily tracker for the 75 Hard challenge.",
        start_url: "/",
        scope: "/",
        // standalone is what makes it open without browser chrome once it has
        // been added to the home screen
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0b0c",
        theme_color: "#0b0b0c",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The 3D viewer chunk and the character .glb models ARE precached, and
        // that is deliberate: the forest panda is a <model-viewer>, so both are
        // on the critical path of the very first screen, not behind a tap.
        // Leaving them to the runtime CacheFirst rule below meant they were
        // only ever cached as a side effect of a visit that got far enough to
        // mount the panda -- so a first visit that was interrupted, or one on a
        // flaky connection, cached nothing and paid the full ~1.1MB again next
        // time. Precaching fetches them during service-worker install, off the
        // critical path, and makes every subsequent load a guaranteed hit with
        // no revalidation.
        //
        // public/avatars/*.glb stays out: 6MB for the old Runner avatars, which
        // nothing renders any more (Runner's Avatar3D export is unreferenced).
        // Draco/Basis decoders stay out too -- the character models are plain
        // glTF with no compression extensions, so model-viewer never asks for
        // them; the ignore is future-proofing, and one of those chunks is
        // ~720KB, which would fail the build if it were ever precached.
        //
        // The forest background is precached for the same reason: as WebP it is
        // ~120KB rather than the 1.8MB PNG it replaced, and it is the first
        // thing you see.
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,glb}"],
        globIgnores: [
          "**/avatars/*.glb",
          "**/draco_*.js",
          "**/basis_transcoder-*.js",
        ],
        // Sized to admit the ~1.05MB model-viewer runtime. Anything genuinely
        // huge is excluded by name above rather than by slipping under a cap.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // The API must never be served from cache -- a stale streak is worse
        // than no streak. Navigation falls back to the shell when offline.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            // Backstop for the heavy assets that are NOT precached above -- the
            // Draco/Basis decoders if a compressed model is ever shipped, and
            // the avatars/*.glb set if anything starts rendering it again. The
            // precache route is registered first, so anything already in the
            // precache is served from there and never reaches this rule.
            // Big, content-hashed, rarely changed: cache once, reuse for weeks.
            urlPattern: /model-viewer-.*\.js$|draco_.*\.js$|basis_transcoder-.*\.js$|\.glb$/,
            handler: "CacheFirst",
            options: {
              cacheName: "heavy-assets",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  // `npm run build && npm run preview` mirrors production, service worker and
  // all, which `npm run dev` deliberately does not.
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
