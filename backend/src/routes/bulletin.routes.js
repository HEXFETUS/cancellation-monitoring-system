import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the same uploads directory as posts/profile pictures so the static
// handler at /uploads serves bulletin attachments too.
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer: jpg/png/mp4 only, 10 MB per file, max 5 files per message.
// Mirrors the rules in posts.routes.js so users can't sneak through .gif
// or .mov via this endpoint.
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `bulletin-${uniqueSuffix}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        const allowedExt = /\.(jpe?g|png|mp4)$/i;
        const allowedMime = /^(image\/(jpe?g|png)|video\/mp4)$/i;
        if (allowedExt.test(file.originalname) && allowedMime.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("ATTACHMENT_TYPE_REJECTED"));
    },
});

const router = express.Router();

// Pull the caller identity from the same places the rest of the app does
// (no real auth middleware yet). The bulletin routes always require it.
function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

async function loadCaller(req) {
    const rawId = getUserId(req);
    if (rawId === undefined || rawId === null || rawId === "") return null;
    const userId = Number(rawId);
    if (!Number.isFinite(userId)) return null;
    const result = await pool.query(
        "SELECT id, usertype FROM users WHERE id = $1::int",
        [userId]
    );
    return result.rows[0] ?? null;
}

// Build the SELECT shape the UI expects: message fields + denormalised
// sender identity + a quoted preview of the reply target. The reply_to
// preview uses a LEFT JOIN so deleted targets resolve to NULL columns,
// which the frontend renders as "Original message deleted".
const FEED_SELECT = `
    SELECT
        m.id,
        m.message,
        m.attachment_urls,
        m.created_at,
        m.is_pinned,
        m.reply_to_id,
        m.sender_id,
        COALESCE(u.name, 'Deleted user') AS sender_name,
        u.profile_picture AS sender_profile_picture,
        u.usertype AS sender_role,
        rt.id AS reply_to_message_id,
        COALESCE(ru.name, 'Deleted user') AS reply_to_sender_name,
        rt.message AS reply_to_message,
        rt.attachment_urls AS reply_to_attachment_urls
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages rt ON rt.id = m.reply_to_id
    LEFT JOIN users ru ON ru.id = rt.sender_id
`;

function parseUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function shapeRow(row) {
    const replyTo = row.reply_to_message_id
        ? {
              id: row.reply_to_message_id,
              sender_name: row.reply_to_sender_name,
              message:
                  typeof row.reply_to_message === "string" && row.reply_to_message.length > 120
                      ? row.reply_to_message.slice(0, 120) + "..."
                      : row.reply_to_message,
              attachment_count: parseUrls(row.reply_to_attachment_urls).length,
          }
        : null;

    return {
        id: row.id,
        message: row.message,
        attachment_urls: parseUrls(row.attachment_urls),
        created_at: row.created_at,
        is_pinned: row.is_pinned,
        reply_to_id: row.reply_to_id,
        reply_to: replyTo,
        sender: {
            id: row.sender_id,
            name: row.sender_name,
            profile_picture: row.sender_profile_picture,
            role: row.sender_role,
        },
    };
}

// GET /api/bulletin — paginated chat feed.
// Cursors: `after_id` → strictly newer rows (live polling), `before_id` →
// older rows (scroll-up history). When neither is supplied we return the
// most recent `limit` rows ordered ascending so the UI renders bottom-up.
router.get("/", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const limitRaw = req.query.limit;
        let limit = 50;
        if (limitRaw !== undefined && limitRaw !== "") {
            const parsed = Number(limitRaw);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
                return res.status(400).json({ error: "INVALID_LIMIT" });
            }
            limit = parsed;
        }

        const beforeRaw = req.query.before_id;
        const afterRaw = req.query.after_id;
        const hasBefore = beforeRaw !== undefined && beforeRaw !== "";
        const hasAfter = afterRaw !== undefined && afterRaw !== "";
        if (hasBefore && hasAfter) {
            return res.status(400).json({ error: "INVALID_CURSOR" });
        }

        let rows;
        if (hasBefore) {
            const beforeId = Number(beforeRaw);
            if (!Number.isInteger(beforeId) || beforeId < 1) {
                return res.status(400).json({ error: "INVALID_CURSOR" });
            }
            const result = await pool.query(
                `${FEED_SELECT}
                 WHERE m.id < $1::int
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $2::int`,
                [beforeId, limit]
            );
            // Reverse so the response is still ascending oldest → newest.
            rows = result.rows.reverse();
        } else if (hasAfter) {
            const afterId = Number(afterRaw);
            if (!Number.isInteger(afterId) || afterId < 0) {
                return res.status(400).json({ error: "INVALID_CURSOR" });
            }
            const result = await pool.query(
                `${FEED_SELECT}
                 WHERE m.id > $1::int
                 ORDER BY m.created_at ASC, m.id ASC
                 LIMIT $2::int`,
                [afterId, limit]
            );
            rows = result.rows;
        } else {
            // Initial load: most recent `limit` messages, oldest at top.
            const result = await pool.query(
                `${FEED_SELECT}
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $1::int`,
                [limit]
            );
            rows = result.rows.reverse();
        }

        res.json({ messages: rows.map(shapeRow) });
    } catch (err) {
        console.error("Error fetching bulletin feed:", err.message);
        res.status(500).json({ error: "Failed to fetch bulletin feed" });
    }
});

// GET /api/bulletin/pinned — list of currently pinned messages, newest first.
// Rendered as a sticky banner above the live feed for everyone.
router.get("/pinned", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        const result = await pool.query(
            `${FEED_SELECT}
             WHERE m.is_pinned = true
             ORDER BY m.created_at DESC, m.id DESC`
        );
        res.json({ messages: result.rows.map(shapeRow) });
    } catch (err) {
        console.error("Error fetching pinned messages:", err.message);
        res.status(500).json({ error: "Failed to fetch pinned messages" });
    }
});

// GET /api/bulletin/unread-count — count of messages newer than the
// caller's last_read_message_id. Used to drive the sidebar badge.
router.get("/unread-count", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        const markerRes = await pool.query(
            "SELECT last_read_message_id FROM bulletin_read_markers WHERE user_id = $1::int",
            [caller.id]
        );
        const lastRead = markerRes.rows[0]?.last_read_message_id ?? 0;
        const countRes = await pool.query(
            "SELECT COUNT(*)::int AS n FROM messages WHERE id > $1::int",
            [lastRead]
        );
        res.json({ unread: countRes.rows[0]?.n ?? 0, last_read_message_id: lastRead });
    } catch (err) {
        console.error("Error fetching unread count:", err.message);
        res.status(500).json({ error: "Failed to fetch unread count" });
    }
});

// POST /api/bulletin/read — mark messages up to and including `last_id` as
// read for the caller. Idempotent: never moves the marker backwards.
router.post("/read", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        const lastId = Number(req.body?.last_id);
        if (!Number.isInteger(lastId) || lastId < 0) {
            return res.status(400).json({ error: "INVALID_LAST_ID" });
        }
        await pool.query(
            `INSERT INTO bulletin_read_markers (user_id, last_read_message_id)
             VALUES ($1::int, $2::int)
             ON CONFLICT (user_id) DO UPDATE
             SET last_read_message_id = GREATEST(bulletin_read_markers.last_read_message_id, EXCLUDED.last_read_message_id),
                 updated_at = CURRENT_TIMESTAMP`,
            [caller.id, lastId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Error updating read marker:", err.message);
        res.status(500).json({ error: "Failed to update read marker" });
    }
});

// POST /api/bulletin — create a new chat message. multer handles the
// upload; field name is `attachments` (up to 5). Body fields: `message`,
// optional `reply_to_id`, plus the `user_id` shim used everywhere else.
router.post("/", upload.array("attachments", 5), async (req, res) => {
    // multer ran first, so any uploaded files are already on disk. If the
    // request is rejected below we best-effort delete them to avoid orphans.
    const cleanupUploaded = () => {
        for (const f of req.files ?? []) {
            fs.unlink(path.join(uploadsDir, f.filename), () => {});
        }
    };

    try {
        const caller = await loadCaller(req);
        if (!caller) {
            cleanupUploaded();
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }

        const body = String(req.body?.message ?? "").trim();
        const files = req.files ?? [];

        if (!body && files.length === 0) {
            cleanupUploaded();
            return res.status(400).json({ error: "EMPTY_MESSAGE" });
        }
        if (body.length > 2000) {
            cleanupUploaded();
            return res.status(400).json({ error: "MESSAGE_TOO_LONG" });
        }

        // Optional reply target — must reference an existing message id.
        let replyToId = null;
        const rawReplyTo = req.body?.reply_to_id;
        if (rawReplyTo !== undefined && rawReplyTo !== null && rawReplyTo !== "") {
            const parsed = Number(rawReplyTo);
            if (!Number.isInteger(parsed) || parsed < 1) {
                cleanupUploaded();
                return res.status(400).json({ error: "REPLY_TARGET_NOT_FOUND" });
            }
            const target = await pool.query(
                "SELECT id FROM messages WHERE id = $1::int",
                [parsed]
            );
            if (target.rows.length === 0) {
                cleanupUploaded();
                return res.status(400).json({ error: "REPLY_TARGET_NOT_FOUND" });
            }
            replyToId = parsed;
        }

        const attachmentUrls = files.map((f) => `/uploads/${f.filename}`);

        const insert = await pool.query(
            `INSERT INTO messages (sender_id, message, attachment_urls, reply_to_id, is_pinned)
             VALUES ($1::int, $2, $3, $4, false)
             RETURNING id`,
            [caller.id, body, JSON.stringify(attachmentUrls), replyToId]
        );

        const newId = insert.rows[0].id;
        const result = await pool.query(
            `${FEED_SELECT} WHERE m.id = $1::int`,
            [newId]
        );
        res.status(201).json(shapeRow(result.rows[0]));
    } catch (err) {
        cleanupUploaded();
        if (err && err.message === "ATTACHMENT_TYPE_REJECTED") {
            return res.status(400).json({ error: "ATTACHMENT_TYPE_REJECTED" });
        }
        if (err && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "ATTACHMENT_TOO_LARGE" });
        }
        if (err && err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ error: "ATTACHMENT_LIMIT_EXCEEDED" });
        }
        console.error("Error creating bulletin message:", err.message);
        res.status(500).json({ error: "Failed to create message" });
    }
});

// DELETE /api/bulletin/:id — sender deletes own; admin deletes any.
// Removes attachment files from disk on a best-effort basis.
router.delete("/:id", async (req, res) => {
    try {
        const caller = await loadCaller(req);
        if (!caller) {
            return res.status(401).json({ error: "UNAUTHENTICATED" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        const lookup = await pool.query(
            "SELECT id, sender_id, attachment_urls FROM messages WHERE id = $1::int",
            [id]
        );
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }
        const row = lookup.rows[0];
        if (row.sender_id !== caller.id && caller.usertype !== "admin") {
            return res.status(403).json({ error: "FORBIDDEN" });
        }

        await pool.query("DELETE FROM messages WHERE id = $1::int", [id]);

        // Best-effort attachment cleanup. Per the spec, file removal failure
        // doesn't fail the request — the row is already gone.
        for (const url of parseUrls(row.attachment_urls)) {
            if (typeof url === "string" && url.startsWith("/uploads/")) {
                fs.unlink(path.join(uploadsDir, path.basename(url)), () => {});
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("Error deleting bulletin message:", err.message);
        res.status(500).json({ error: "Failed to delete message" });
    }
});

// PATCH /api/bulletin/:id/pin — admin-only pin/unpin toggle.
// Body: { pinned: boolean }
router.patch("/:id/pin", async (req, res) => {
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

        const pinned = req.body?.pinned === true || req.body?.pinned === "true";
        const result = await pool.query(
            "UPDATE messages SET is_pinned = $1 WHERE id = $2::int RETURNING id",
            [pinned, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "NOT_FOUND" });
        }

        const refreshed = await pool.query(
            `${FEED_SELECT} WHERE m.id = $1::int`,
            [id]
        );
        res.json(shapeRow(refreshed.rows[0]));
    } catch (err) {
        console.error("Error pinning bulletin message:", err.message);
        res.status(500).json({ error: "Failed to update pin state" });
    }
});

export default router;
