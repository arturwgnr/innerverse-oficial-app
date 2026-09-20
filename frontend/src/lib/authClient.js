import { createAuthClient } from "better-auth/react";

// No baseURL in prod (UPDATES.md "Fix: mobile Safari login"), same reasoning
// as lib/api.js: omitting it lets better-auth default to same-origin
// requests, which vercel.json rewrites through to the Render backend
// server-side, keeping the session cookie first-party for mobile Safari.
export const authClient = createAuthClient({
  ...(import.meta.env.PROD ? {} : { baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000" }),
  basePath: "/api/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
