import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "75 Hard",
        short_name: "75 Hard",
        description: "A shared daily tracker for the 75 Hard challenge.",
        start_url: "/",
        scope: "/",
        // standalone is what makes it open without browser chrome once it has
        // been added to the home screen
        display: "standalone",
        orientation: "any",
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
        // Keep the guaranteed app shell small. Heavy visual files are still
        // cached on the user's device, but through CacheFirst runtime rules
        // when a route actually asks for them. That avoids pulling the 3D
        // viewer, models, story art, or map art during service-worker install
        // on admin/share/invite pages.
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,glb}"],
        globIgnores: [
          "**/model-viewer-*.js",
          "**/*.glb",
          "**/draco_*.js",
          "**/basis_transcoder-*.js",
          "**/Adventure-*.js",
          "**/Adventure-*.css",
          "**/assets/story/**",
          // The week map's background art is a 2.6MB PNG (no lossy re-encode
          // tooling available when it was added) -- same reasoning as the
          // Adventure chunk above: it sits behind a tap, not on the critical
          // path, so it is cached at runtime instead of during SW install.
          "**/assets/weekmap-bg.png",
          // The Phaser migration's preview chunk (bundles the ~1.4MB Phaser
          // runtime) -- gated behind ?engine=phaser and lazy-loaded on the
          // React side (see App.tsx), so it must also stay out of the SW's
          // eager install-time precache or every visitor downloads it
          // regardless of ever opting in. Same reasoning as Adventure above.
          "**/PhaserForestScene-*.js",
          // User-triggered panels. CoachChat carries WebLLM (~6MB), and the
          // minigame / week map sit behind explicit taps, so cache them when
          // opened rather than pulling them during service-worker install.
          "**/CoachChat-*.js",
          "**/Minigames-*.js",
          "**/WeekMap-*.js",
          "**/WeekMap-*.css",
        ],
        // Sized to admit the app shell. Deliberately lazy story/Phaser/model
        // assets are excluded by name above rather than slipping under this cap.
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
        // The API must never be served from cache -- a stale streak is worse
        // than no streak. Navigation falls back to the shell when offline.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/PhaserForestScene-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "phaser-preview-assets",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/assets\/(?:Adventure-[^/]+\.(?:js|css)|story\/[^/]+\.webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "panda-adventure-assets",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/assets\/(?:CoachChat|Minigames|WeekMap)-[^/]+\.(?:js|css)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "on-demand-ui",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/assets\/weekmap-bg\.png$/,
            handler: "CacheFirst",
            options: {
              cacheName: "weekmap-assets",
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            // Big, content-hashed, rarely changed visual dependencies: cache
            // once on first real use, then reuse for weeks.
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
