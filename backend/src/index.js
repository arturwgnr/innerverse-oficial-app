import "dotenv/config";

// Global safety nets. Without these, any rejected promise that nobody awaits
// or catches (a background profile merge, an auth email send, a stray pg
// query) crashes the whole process silently, which is what made the server
// print "listening" and then die right after: the real error was never
// printed anywhere, Node just exited.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, the process will exit:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (process kept running):", reason);
});

import path from "node:path";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import entriesRouter from "./routes/entries.js";
import onboardingRouter from "./routes/onboarding.js";
import profileRouter from "./routes/profile.js";
import patternsRouter from "./routes/patterns.js";
import aboutMeRouter from "./routes/aboutMe.js";
import correctionsRouter from "./routes/corrections.js";
import uploadsRouter from "./routes/uploads.js";
import calendarOverridesRouter from "./routes/calendarOverrides.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Better Auth owns raw request parsing for its own routes, so it is mounted
// before express.json() runs on the rest of the app.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/onboarding", onboardingRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/profile", profileRouter);
app.use("/api/patterns", patternsRouter);
app.use("/api/about-me", aboutMeRouter);
app.use("/api/corrections", correctionsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/calendar-overrides", calendarOverridesRouter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`Innerverse backend listening on port ${port}`),
);
