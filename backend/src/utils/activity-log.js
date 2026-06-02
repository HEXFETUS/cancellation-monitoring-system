import pool from "../config/db.js";

/**
 * Record a user action for the Settings → Activity Logs admin view.
 *
 * Designed to be called from inside route handlers without ever throwing —
 * audit logging should never take down the user-facing request that
 * triggered it. Failures are logged to stderr and swallowed.
 *
 * Pull the actor's user id from the same shim the rest of the API uses:
 * body.user_id ?? query.user_id ?? header x-user-id. NULL when unknown.
 *
 * @param {object} req - Express request (used to extract the actor id).
 * @param {object} entry
 * @param {"create"|"update"|"delete"|"upload"|"login"|"logout"|"pin"|"unpin"|"other"} entry.action
 * @param {string} entry.entity - free-form noun, e.g. "user", "asset", "asset_code", "message".
 * @param {number|null} [entry.entity_id]
 * @param {string} [entry.summary] - short human-readable description.
 * @param {object} [entry.details] - any extra JSON-serializable context.
 */
export async function recordActivity(req, entry) {
    try {
        const userId = extractUserId(req);
        const summary =
            typeof entry.summary === "string" ? entry.summary.slice(0, 500) : null;
        const detailsJson =
            entry.details === undefined || entry.details === null
                ? null
                : JSON.stringify(entry.details);

        await pool.query(
            `INSERT INTO activity_logs (user_id, action, entity, entity_id, summary, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                String(entry.action || "other").slice(0, 50),
                String(entry.entity || "unknown").slice(0, 64),
                Number.isFinite(Number(entry.entity_id)) ? Number(entry.entity_id) : null,
                summary,
                detailsJson,
            ]
        );
    } catch (err) {
        // Never let audit failures break the actual request.
        console.error("activity-log: failed to record entry", err.message);
    }
}

function extractUserId(req) {
    const raw =
        req?.body?.user_id ??
        req?.query?.user_id ??
        req?.headers?.["x-user-id"] ??
        null;
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}
