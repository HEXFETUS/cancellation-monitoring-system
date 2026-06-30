import express from "express";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

async function loadCaller(req) {
    const rawId = getUserId(req);
    if (rawId === undefined || rawId === null || rawId === "") return null;
    const userId = Number(rawId);
    if (!Number.isFinite(userId)) return null;
    const result = await pool.query(
        "SELECT id, usertype, name FROM users WHERE id = $1::int",
        [userId]
    );
    return result.rows[0] ?? null;
}

const ANNOUNCEMENT_SELECT = `
    SELECT
        a.id,
        a.title,
        a.description,
        a.target_audience,
        a.display_type,
        a.scheduled_at,
        a.priority_level,
        a.status,
        a.published_at,
        a.created_by,
        COALESCE(u.name, 'Unknown') AS created_by_name,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
`;

function shapeRow(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        target_audience: row.target_audience ? JSON.parse(row.target_audience) : [],
        display_type: row.display_type,
        scheduled_at: row.scheduled_at,
        priority_level: row.priority_level,
        status: row.status,
        published_at: row.published_at,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// ---------------------------------------------------------------------------
// GET /api/announcements — list all announcements (most recent first)
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const { status, limit: limitRaw } = req.query;
        let limit = 50;
        if (limitRaw !== undefined && limitRaw !== "") {
            const parsed = Number(limitRaw);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
                return res.status(400).json({ error: "INVALID_LIMIT" });
            }
            limit = parsed;
        }

        let whereClause = "";
        const params = [];
        let paramIdx = 1;

        if (status) {
            whereClause = `WHERE a.status = $${paramIdx}::text`;
            params.push(status);
            paramIdx++;
        }

        const result = await pool.query(
            `${ANNOUNCEMENT_SELECT} ${whereClause} ORDER BY a.created_at DESC LIMIT $${paramIdx}::int`,
            [...params, limit]
        );

        res.json({ announcements: result.rows.map(shapeRow) });
    } catch (err) {
        console.error("Error fetching announcements:", err.message);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
});

// ---------------------------------------------------------------------------
// GET /api/announcements/:id — single announcement
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }
        const result = await pool.query(
            `${ANNOUNCEMENT_SELECT} WHERE a.id = $1::int`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }
        res.json(shapeRow(result.rows[0]));
    } catch (err) {
        console.error("Error fetching announcement:", err.message);
        res.status(500).json({ error: "Failed to fetch announcement" });
    }
});

// ---------------------------------------------------------------------------
// POST /api/announcements — create announcement
// Body: { title, description, target_audience, display_type, scheduled_at,
//         priority_level, status }
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        if (caller.usertype !== "admin") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        const {
            title,
            description,
            target_audience,
            display_type,
            scheduled_at,
            priority_level,
            status,
        } = req.body;

        // Validation
        if (!title || String(title).trim().length === 0) {
            return res.status(400).json({ error: "Title is required" });
        }
        const titleStr = String(title).trim();
        if (titleStr.length > 100) {
            return res.status(400).json({ error: "Title must be 100 characters or less" });
        }
        if (!description || String(description).trim().length === 0) {
            return res.status(400).json({ error: "Description is required" });
        }
        const descStr = String(description).trim();

        const audience = target_audience && Array.isArray(target_audience)
            ? target_audience.filter(Boolean)
            : ["All Users"];
        const display = display_type || "banner";
        const priority = priority_level || "low";
        const now = new Date().toISOString();
        let finalStatus = status || "draft";

        // Determine published_at
        let scheduledAt = null;
        let publishedAt = null;
        if (scheduled_at) {
            scheduledAt = new Date(scheduled_at).toISOString();
        }
        if (finalStatus === "published") {
            publishedAt = now;
        }

        const insert = await pool.query(
            `INSERT INTO announcements
                (title, description, target_audience, display_type, scheduled_at,
                 priority_level, status, published_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
                titleStr,
                descStr,
                JSON.stringify(audience),
                display,
                scheduledAt,
                priority,
                finalStatus,
                publishedAt,
                caller.id,
            ]
        );

        const newId = insert.rows[0].id;
        const result = await pool.query(
            `${ANNOUNCEMENT_SELECT} WHERE a.id = $1::int`,
            [newId]
        );

        await recordActivity(req, {
            action: "create",
            entity: "announcement",
            entity_id: newId,
            summary: `Created announcement: ${titleStr.slice(0, 80)}${titleStr.length > 80 ? "..." : ""}`,
        });

        res.status(201).json(shapeRow(result.rows[0]));
    } catch (err) {
        console.error("Error creating announcement:", err.message);
        res.status(500).json({ error: "Failed to create announcement" });
    }
});

// ---------------------------------------------------------------------------
// PUT /api/announcements/:id — update announcement
// ---------------------------------------------------------------------------
router.put("/:id", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        if (caller.usertype !== "admin") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        // Check exists
        const existing = await pool.query(
            "SELECT id, status FROM announcements WHERE id = $1::int",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        const {
            title,
            description,
            target_audience,
            display_type,
            scheduled_at,
            priority_level,
            status,
        } = req.body;

        const titleStr = title ? String(title).trim() : undefined;
        if (title !== undefined && (!titleStr || titleStr.length > 100)) {
            return res.status(400).json({ error: "Title must be 1–100 characters" });
        }
        const descStr = description !== undefined ? String(description).trim() : undefined;
        const audience = target_audience !== undefined
            ? (Array.isArray(target_audience) ? target_audience.filter(Boolean) : ["All Users"])
            : undefined;
        const display = display_type || undefined;
        const priority = priority_level || undefined;
        let finalStatus = status;
        const now = new Date().toISOString();

        let scheduledAt = undefined;
        if (scheduled_at !== undefined) {
            scheduledAt = scheduled_at ? new Date(scheduled_at).toISOString() : null;
        }
        let publishedAt = undefined;
        if (finalStatus === "published" && existing.rows[0].status !== "published") {
            publishedAt = now;
        }

        const result = await pool.query(
            `UPDATE announcements SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                target_audience = COALESCE($3, target_audience),
                display_type = COALESCE($4, display_type),
                scheduled_at = COALESCE($5, scheduled_at),
                priority_level = COALESCE($6, priority_level),
                status = COALESCE($7, status),
                published_at = COALESCE($8, published_at),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $9::int
             RETURNING id`,
            [
                titleStr ?? null,
                descStr ?? null,
                audience ? JSON.stringify(audience) : null,
                display ?? null,
                scheduledAt ?? null,
                priority ?? null,
                finalStatus ?? null,
                publishedAt ?? null,
                id,
            ]
        );

        const refreshed = await pool.query(
            `${ANNOUNCEMENT_SELECT} WHERE a.id = $1::int`,
            [result.rows[0].id]
        );

        await recordActivity(req, {
            action: "update",
            entity: "announcement",
            entity_id: id,
            summary: `Updated announcement #${id}`,
        });

        res.json(shapeRow(refreshed.rows[0]));
    } catch (err) {
        console.error("Error updating announcement:", err.message);
        res.status(500).json({ error: "Failed to update announcement" });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/announcements/:id — delete announcement (admin only)
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        if (caller.usertype !== "admin") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        const lookup = await pool.query(
            "SELECT id, title FROM announcements WHERE id = $1::int",
            [id]
        );
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        await pool.query("DELETE FROM announcements WHERE id = $1::int", [id]);

        await recordActivity(req, {
            action: "delete",
            entity: "announcement",
            entity_id: id,
            summary: `Deleted announcement: ${lookup.rows[0].title}`,
        });

        res.json({ ok: true });
    } catch (err) {
        console.error("Error deleting announcement:", err.message);
        res.status(500).json({ error: "Failed to delete announcement" });
    }
});

export default router;