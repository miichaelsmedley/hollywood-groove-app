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
  },
});

