import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
        // The 3D viewer chunk, the .glb models and the forest artwork are
        // megabytes and aren't needed to open the app, so they stay out of the
        // precache and load on demand instead. Precaching them would also blow
        // past maximumFileSizeToCacheInBytes and fail the build.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: [
          "**/model-viewer-*.js",
          "**/assets/forest-background.png",
          "**/assets/panda-character.png",
        ],
        maximumFileSizeToCacheInBytes: 600 * 1024,
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
            // big, immutable, rarely changed -- cache once, reuse forever
            urlPattern: /model-viewer-.*\.js$|\.glb$|\/assets\/(forest-background|panda-character)\.png$/,
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
