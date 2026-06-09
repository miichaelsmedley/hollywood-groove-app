import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // Root path for the Cloudflare Workers deployment
  esbuild: {
    // Strip noisy console.log/info/debug from production bundles — several of
    // them logged buyer email + uid. console.warn/error are kept for real
    // diagnostics. esbuild only drops these when minifying, so dev keeps them.
    pure: ["console.log", "console.info", "console.debug"],
  },
  server: {
    headers: {
      // Allow Firebase Auth popup to communicate with opener window
      // Without this, COOP blocks window.closed checks
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("firebase")) {
            return "firebase";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          // QR *scanning* (html5-qrcode) is heavy (~330 KB) and only used on
          // the /scan door-scanner route. Its own chunk keeps it off every
          // other page — critically the public event page (cold ad traffic).
          if (id.includes("html5-qrcode")) {
            return "qr-scan";
          }

          // QR *generation* (qrcode.react) is small — used by the wallet.
          if (id.includes("@yudiel/react-qr-scanner") || id.includes("qrcode.react")) {
            return "qr-gen";
          }

          return "vendor";
        },
      },
    },
  },
});
