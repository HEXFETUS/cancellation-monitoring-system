import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { authLimiter } from "./src/middleware/rate-limiter.js";
import { authenticate, authorizeRole, createPrivateUploadUrl } from "./src/middleware/auth.js";
import rateLimit from "express-rate-limit";

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
import announcementRoutes from "./src/routes/announcement.routes.js";
import adminAnnouncementRoutes from "./src/routes/admin-announcement.routes.js";
import activityLogRoutes from "./src/routes/activity-log.routes.js";
import cellphoneRoutes from "./src/routes/cellphone.routes.js";
import cpBoothChangeRequestRoutes from "./src/routes/cp-booth-change-request.routes.js";
import cpOperatorChangeRequestRoutes from "./src/routes/cp-operator-change-request.routes.js";
import messagesRoutes from "./src/routes/messages.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import eventsNewsRoutes from "./src/routes/events-news.routes.js";
import landingPageRoutes from "./src/routes/landing-page.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import fileAccessRoutes from "./src/routes/file-access.routes.js";
import initDatabase from "./src/config/init.js";
import { dbState, pingDatabase } from "./src/config/db.js";

dotenv.config();

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production");
}

const app = express();

// Trust the first proxy (Render's load balancer) so that req.ip reflects
// the real client IP instead of the proxy's internal address. Required by
// express-rate-limit to correctly identify visitors behind a reverse proxy.
app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        // Non-browser clients have no Origin header and must still present a token.
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
}));
app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
});
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited", message: "Too many requests. Please try again later." },
}));

// Serve uploaded files from the same directory used by the multer routes.
const uploadsDirectory = path.join(__dirname, "src", "public", "uploads");
const publicUploads = express.static(uploadsDirectory);
app.use("/uploads", async (req, res, next) => {
    const filename = path.basename(req.path);
    const rawUrl = `/uploads/${filename}`;
    if (/^(msg|bulletin)-[\w.-]+$/i.test(filename)) return res.sendStatus(404);
    try {
        // Asset media can contain internal inventory evidence; never expose it
        // through a guessable static filename. It is served only by the signed
        // endpoint below. Existing public landing/profile assets still work.
        const asset = await (await import("./src/config/db.js")).default.query(
            "SELECT 1 FROM asset_media WHERE url = $1 LIMIT 1", [rawUrl]
        );
        if (asset.rows.length) return res.sendStatus(404);
        return publicUploads(req, res, next);
    } catch (err) {
        // Fail closed: serving an unknown upload while the media lookup is
        // unavailable could disclose a protected asset by filename.
        console.error("upload access check failed:", err.message);
        return res.status(503).json({ error: "file_access_unavailable" });
    }
});

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
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/files", fileAccessRoutes);
// The public home page intentionally reads only its published content. Its
// write operations still pass through authentication and the admin-only
// default role policy below.
app.use("/api/landing-page", (req, res, next) => {
    if (req.method === "GET") return next();
    return authenticate(req, res, () => authorizeRole(req, res, next));
}, landingPageRoutes);
// Default deny: all application APIs require a valid, signed, expiring session.
// Login and the minimal health probe above are the only deliberate exceptions.
app.use("/api", authenticate);
app.use("/api", authorizeRole);
app.use("/api", (req, res, next) => {
    const sendJson = res.json.bind(res);
    const replacePrivateUrls = (value) => {
        if (typeof value === "string") {
            const match = /^\/uploads\/((?:msg|bulletin)-[\w.-]+)$/i.exec(value);
            return match ? createPrivateUploadUrl(match[1]) : value;
        }
        if (Array.isArray(value)) return value.map(replacePrivateUrls);
        if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePrivateUrls(item)]));
        }
        return value;
    };
    res.json = (body) => sendJson(replacePrivateUrls(body));
    next();
});
app.use("/api/users", userRoutes);
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
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin-announcements", adminAnnouncementRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/cellphones", cellphoneRoutes);
app.use("/api/cp-booth-change-requests", cpBoothChangeRequestRoutes);
app.use("/api/cp-operator-change-requests", cpOperatorChangeRequestRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/events-news", eventsNewsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Do not return framework stack traces or route details to external clients.
app.use((err, _req, res, _next) => {
    console.error("Request failed:", err.message);
    res.status(err.statusCode || 500).json({ error: "request_failed" });
});

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
