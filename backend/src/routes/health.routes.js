import express from "express";
import { dbState } from "../config/db.js";

const router = express.Router();

/**
 * Lightweight liveness probe. Always answers, regardless of DB state, so
 * the frontend (and the Vite proxy) can tell the difference between:
 *   - "backend up, DB ready"           -> 200
 *   - "backend up, DB still starting"  -> 200 with db.status='starting'
 *   - "backend up, DB unreachable"     -> 503 with db.status='down'
 *
 * Keeping this on a single endpoint means the frontend doesn't need a
 * second "is the server alive" check — if /api/health answers, the
 * Express process is running.
 */
router.get("/", (req, res) => {
    const dbUp = dbState.status === "ok";
    const body = {
        status: dbUp ? "ok" : "degraded",
        message: dbUp
            ? "API is healthy 🚀"
            : "API is up but the database is not reachable yet.",
        db: {
            status: dbState.status,
            lastError: dbState.lastError,
            lastConnectedAt: dbState.lastConnectedAt,
            attempt: dbState.attempt,
        },
    };
    return res.status(dbUp ? 200 : 503).json(body);
});

export default router;
