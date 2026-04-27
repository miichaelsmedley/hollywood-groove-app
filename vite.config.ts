import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // Root path for Azure Static Web Apps deployment
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

          if (id.includes("@yudiel/react-qr-scanner") || id.includes("qrcode.react")) {
            return "qr";
          }

          return "vendor";
        },
      },
    },
  },
});
