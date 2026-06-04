import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Resolve the caller from the x-user-id header. Kept distinct from
// query.user_id because that param is a row filter ("show only this user's
// activity"), and the two would clash if we shared them.
async function loadAdminCaller(req) {
    const raw = req.headers?.["x-user-id"];
    if (raw === undefined || raw === null || raw === "") return null;
    const id = Number(raw);
    if (!Number.isFinite(id)) return null;
    const result = await pool.query(
        "SELECT id, usertype FROM users WHERE id = $1::int",
        [id]
    );
    const row = result.rows[0];
    if (!row || row.usertype !== "admin") return null;
    return row;
}

// GET /api/activity-logs
// Admin-only. Returns every action recorded across the system, including
// actions performed by other admin accounts.
//
// Query params:
//   limit (default 100, max 500)
//   offset (default 0)
//   action — optional filter
//   entity — optional filter
//   user_id — optional filter to scope to a single actor
router.get("/", async (req, res) => {
    try {
        const caller = await loadAdminCaller(req);
        if (!caller) {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const limitRaw = req.query.limit;
        const offsetRaw = req.query.offset;

        let limit = 100;
        if (limitRaw !== undefined && limitRaw !== "") {
            const parsed = Number(limitRaw);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
                return res.status(400).json({ error: "INVALID_LIMIT" });
            }
            limit = parsed;
        }

        let offset = 0;
        if (offsetRaw !== undefined && offsetRaw !== "") {
            const parsed = Number(offsetRaw);
            if (!Number.isInteger(parsed) || parsed < 0) {
                return res.status(400).json({ error: "INVALID_OFFSET" });
            }
            offset = parsed;
        }

        const filters = [];
        const params = [];
        if (req.query.action) {
            params.push(String(req.query.action));
            filters.push(`al.action = $${params.length}`);
        }
        if (req.query.entity) {
            params.push(String(req.query.entity));
            filters.push(`al.entity = $${params.length}`);
        }
        if (req.query.user_id) {
            const id = Number(req.query.user_id);
            if (Number.isFinite(id)) {
                params.push(id);
                filters.push(`al.user_id = $${params.length}`);
            }
        }
        const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

        params.push(limit, offset);
        const limitIndex = params.length - 1;
        const offsetIndex = params.length;

        const result = await pool.query(
            `SELECT
                al.id,
                al.user_id,
                COALESCE(u.name, 'Unknown user') AS user_name,
                u.usertype AS user_role,
                al.action,
                al.entity,
                al.entity_id,
                al.summary,
                al.details,
                al.created_at
             FROM activity_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ${whereClause}
             ORDER BY al.created_at DESC, al.id DESC
             LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int`,
            params
        );

        // Total count (ignores limit/offset, respects filters)
        const countParams = params.slice(0, params.length - 2);
        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS n FROM activity_logs al ${whereClause}`,
            countParams
        );

        const rows = result.rows.map((r) => ({
            ...r,
            details: parseDetails(r.details),
        }));

        res.json({ logs: rows, total: countRes.rows[0]?.n ?? 0 });
    } catch (err) {
        console.error("GET /api/activity-logs error:", err.message);
        res.status(500).json({ error: "Failed to fetch activity logs" });
    }
});

function parseDetails(raw) {
    if (raw === null || raw === undefined) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

export default router;
