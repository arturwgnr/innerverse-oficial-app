import { betterAuth } from "better-auth";
import { pool } from "../db/pool.js";
import { sendMail } from "../services/mail.js";

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL].filter(Boolean),
  // Cross-site session cookie for production: the frontend (Vercel) and
  // backend (Render) sit on two different domains, not subdomains of one
  // site, so the cookie's default SameSite=Lax gets silently dropped by the
  // browser on a cross-origin request. Without this, sign-in looks like it
  // succeeds (the API call returns 200) but the session never actually
  // sticks, the very next request comes back unauthenticated. Left out of
  // local dev on purpose: Secure cookies require HTTPS, and localhost isn't.
  ...(process.env.NODE_ENV === "production" && {
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Defaults to required. Only skipped when explicitly set to "false",
    // meant for local development so signing in doesn't need a working
    // mail provider. Must stay "true" (or unset) in production.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Innerverse password",
        html: `<p>Reset your password: <a href="${url}">${url}</a></p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your email for Innerverse",
        html: `<p>Confirm your email: <a href="${url}">${url}</a></p>`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
});
