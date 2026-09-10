import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned, not left to Vite's auto-fallback: backend/.env's FRONTEND_URL
  // (CORS origin, Better Auth trustedOrigins) is only correct if this dev
  // server is actually on 5174 every time, silently drifting to another
  // port breaks sign-in with a CORS error.
  server: { port: 5174, strictPort: true },
});
