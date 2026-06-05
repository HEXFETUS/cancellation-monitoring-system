import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import healthRoutes from "./src/routes/health.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import posRoutes from "./src/routes/pos.routes.js";
import cancellationRoutes from "./src/routes/cancellation.routes.js";
import assetRoutes from "./src/routes/asset.routes.js";
import assetCodeRoutes from "./src/routes/asset-code.routes.js";
import payoutStationRoutes from "./src/routes/payout-station.routes.js";
import officeDepartmentRoutes from "./src/routes/office-department.routes.js";
import boothChangeRequestRoutes from "./src/routes/booth-change-request.routes.js";
import operatorChangeRequestRoutes from "./src/routes/operator-change-request.routes.js";
import boothOperatorChangeRequestRoutes from "./src/routes/booth-operator-change-request.routes.js";
import diagnosisListRoutes from "./src/routes/diagnosis-list.routes.js";
import repairRecordRoutes from "./src/routes/repair-record.routes.js";
import diagnosisLogRoutes from "./src/routes/diagnosis-log.routes.js";
import releasedLogRoutes from "./src/routes/released-log.routes.js";
import postsRoutes from "./src/routes/posts.routes.js";
import bulletinRoutes from "./src/routes/bulletin.routes.js";
import activityLogRoutes from "./src/routes/activity-log.routes.js";
import initDatabase from "./src/config/init.js";
import { dbState, pingDatabase } from "./src/config/db.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve uploaded files from the same directory used by the multer routes.
app.use("/uploads", express.static(path.join(__dirname, "src", "public", "uploads")));

// Lightweight gate for routes that need the DB. We attach this to /api/*
// (after the static handler) so it short-circuits any handler that would
// otherwise crash with a "pool is not ready" error while the DB is still
// coming up. The health route is mounted *before* this gate so /api/health
// always answers with the current DB status.
app.use("/api", (req, res, next) => {
    if (dbState.status === "ok") return next();
    // For state probes let the request through; the route's own logic will
    // report the current DB status. Everything else gets a clean 503.
    if (req.path === "/health") return next();
    return res.status(503).json({
        error: "database_unavailable",
        message:
            "The backend is up but the database is not reachable yet. " +
            "Please retry in a few seconds.",
        db: { status: dbState.status, lastError: dbState.lastError },
    });
});

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/cancellation", cancellationRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/asset-codes", assetCodeRoutes);
app.use("/api/payout-stations", payoutStationRoutes);
app.use("/api/office-departments", officeDepartmentRoutes);
app.use("/api/booth-change-requests", boothChangeRequestRoutes);
app.use("/api/operator-change-requests", operatorChangeRequestRoutes);
app.use("/api/booth-operator-change-requests", boothOperatorChangeRequestRoutes);
app.use("/api/diagnosis-list", diagnosisListRoutes);
app.use("/api/repair-records", repairRecordRoutes);
app.use("/api/diagnosis-logs", diagnosisLogRoutes);
app.use("/api/released-logs", releasedLogRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/bulletin", bulletinRoutes);
app.use("/api/activity-logs", activityLogRoutes);

// Honour the platform-provided PORT in production (Render, Railway, Fly,
// Heroku, etc. all inject one) and fall back to 5050 for local dev so the
// existing Vite proxy (frontend/vite.config.ts) continues to work.
const PORT = process.env.PORT || 5050;

// A single stray promise rejection (e.g. an unguarded DB query in a route
// handler) used to terminate Node 24 by default. Log and keep serving —
// Vite's proxy still needs a TCP socket to talk to, and the 503 gate above
// turns "DB down" into a clean error response instead of a process exit.
process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("[server] unhandledRejection:", message);
});
process.on("uncaughtException", (err) => {
    console.error("[server] uncaughtException:", err.message);
});

/**
 * Boot the database with a bounded retry loop. Supabase's free tier
 * auto-pauses projects after a few days of inactivity, and the pooler
 * hostname briefly stops resolving while the project wakes up — without
 * retry logic that single transient DNS failure used to crash the whole
 * dev stack. The server keeps listening either way, so the frontend gets
 * proper 503 responses from /api/* instead of ECONNREFUSED.
 */
async function bootstrapDatabase() {
    const MAX_ATTEMPTS = 8; // ~ 2s + 4s + 8s + 16s + 30s*4 ≈ 2.5 min total
    const BASE_DELAY_MS = 2_000;
    const MAX_DELAY_MS = 30_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        dbState.attempt = attempt;
        try {
            console.log(
                `[db] connect attempt ${attempt}/${MAX_ATTEMPTS}...`
            );
            await pingDatabase();
            await initDatabase();
            dbState.status = "ok";
            dbState.lastError = null;
            dbState.lastConnectedAt = new Date().toISOString();
            console.log(`[db] ready (attempt ${attempt})`);
            return;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dbState.status = "down";
            dbState.lastError = message;
            console.warn(
                `[db] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`
            );
            if (attempt === MAX_ATTEMPTS) {
                console.error(
                    "[db] giving up after " +
                        MAX_ATTEMPTS +
                        " attempts. The server is still listening on " +
                        PORT +
                        " — /api/health will report db.status='down' " +
                        "and /api/* will return 503 until the database " +
                        "becomes reachable. Restart the dev server to " +
                        "retry the bootstrap."
                );
                return;
            }
            // Exponential backoff with a hard cap. The first retry is
            // quick (2s) which is what the Supabase wake-up case needs.
            const delay = Math.min(
                BASE_DELAY_MS * 2 ** (attempt - 1),
                MAX_DELAY_MS
            );
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}

// Don't auto-bootstrap (init DB + listen) when the module is imported under a
// test runner. Tests replace the DB pool with an in-memory one and drive the
// app through supertest. Vitest sets NODE_ENV to "test" automatically.
if (process.env.NODE_ENV !== "test") {
    // Start listening FIRST so the Vite proxy always has a TCP socket to
    // talk to. If the DB isn't ready yet, /api/* returns 503 with a clear
    // message; once bootstrap finishes the gate flips to "ok" and traffic
    // flows normally. This is what prevents the cascade of ECONNREFUSED
    // errors in the Vite log when the database is briefly unreachable.
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        // Kick off DB bootstrap in the background; do not block listen().
        bootstrapDatabase().catch((err) => {
            // Should be unreachable — bootstrapDatabase catches its own
            // errors. Belt-and-braces so an unexpected throw still doesn't
            // take the process down.
            console.error("[db] bootstrap crashed:", err.message);
        });
    });
}

export default app;
