import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (images + video), mirroring posts.routes.js
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        const allowedExt = /\.(jpe?g|png|mp4)$/i;
        const allowedMime = /^(image\/(jpe?g|png)|video\/mp4)$/i;
        if (allowedExt.test(file.originalname) && allowedMime.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("Only .jpg, .png, and .mp4 files are allowed"));
    },
});

const router = express.Router();

// Helper: get user ID from request (matches auth pattern used elsewhere)
function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

// Shape a row: parse media_urls from JSON string
function shapeRow(row) {
    return {
        ...row,
        media_urls: JSON.parse(row.media_urls || "[]"),
    };
}

// ─── PUBLIC GET: visible Events & News for the landing page ───────────────
// Auto-publishes any scheduled posts whose time has arrived, then returns
// published posts plus scheduled posts whose scheduled_at has passed.
router.get("/", async (req, res) => {
    try {
        await pool.query(
            `UPDATE events_news
             SET status = 'published',
                 published_at = COALESCE(published_at, NOW()),
                 updated_at = NOW()
             WHERE status = 'scheduled'
               AND scheduled_at <= NOW()`
        );

        const result = await pool.query(
            `SELECT id, title, caption, type, media_urls, location, created_by, created_at, status
             FROM events_news
             WHERE status = 'published'
                OR (status = 'scheduled' AND scheduled_at <= NOW())
             ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
        );

        res.json(result.rows.map(shapeRow));
    } catch (err) {
        console.error("Error fetching events & news:", err.message);
        res.status(500).json({ error: "Failed to fetch events & news" });
    }
});

// ─── CREATE: multipart form with optional media upload ────────────────────
router.post("/", upload.array("media", 5), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { caption, type, location, status, scheduled_at } = req.body;

        if (!caption?.trim()) {
            return res.status(400).json({ error: "caption is required" });
        }

        const validTypes = ["event", "news"];
        const finalType = validTypes.includes(type) ? type : "news";

        const validStatuses = ["published", "scheduled"];
        const finalStatus = validStatuses.includes(status) ? status : "published";

        if (finalStatus === "scheduled" && !scheduled_at) {
            return res.status(400).json({ error: "scheduled_at is required when status is scheduled" });
        }

        // Build media URLs array
        const mediaUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
        const mediaUrlsJson = JSON.stringify(mediaUrls);

        const publishedAt = finalStatus === "published" ? new Date().toISOString() : null;
        const scheduledAt = finalStatus === "scheduled" && scheduled_at
            ? new Date(scheduled_at).toISOString()
            : null;

        const result = await pool.query(
            `INSERT INTO events_news (title, caption, type, media_urls, location, status, scheduled_at, published_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, title, caption, type, media_urls, location, status, scheduled_at, published_at, created_by, created_at`,
            [
                req.body.title?.trim() || null,
                caption.trim(),
                finalType,
                mediaUrlsJson,
                location?.trim() || "",
                finalStatus,
                scheduledAt,
                publishedAt,
                userId,
            ]
        );

        const row = result.rows[0];
        await recordActivity(req, {
            action: "create",
            entity: "events_news",
            entity_id: row.id,
            summary: `Posted ${row.type}: ${row.caption.slice(0, 80)}${row.caption.length > 80 ? "..." : ""}`,
        });

        res.status(201).json(shapeRow(row));
    } catch (err) {
        console.error("Error creating events & news post:", err.message);
        res.status(500).json({ error: "Failed to create post" });
    }
});

// ─── UPDATE ────────────────────────────────────────────────────────────────
// Multipart so new media can be uploaded alongside kept existing media.
// `existing_media` is a JSON array of server URLs the client wants to keep.
// Passing an empty/omitted existing_media (and no new files) clears all media.
router.put("/:id", upload.array("media", 5), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { id } = req.params;
        const { caption, title, type, location, status, scheduled_at, existing_media } = req.body;

        const lookup = await pool.query("SELECT id FROM events_news WHERE id = $1", [id]);
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Determine kept media URLs
        let keptUrls = [];
        if (typeof existing_media === "string" && existing_media.trim()) {
            try {
                const parsed = JSON.parse(existing_media);
                if (Array.isArray(parsed)) keptUrls = parsed.filter((u) => typeof u === "string");
            } catch {
                // ignore malformed; treat as no kept media
            }
        } else if (Array.isArray(existing_media)) {
            keptUrls = existing_media.filter((u) => typeof u === "string");
        }

        // Append newly uploaded files
        const newUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
        const mediaUrls = [...keptUrls, ...newUrls];
        const mediaUrlsJson = JSON.stringify(mediaUrls);

        const validTypes = ["event", "news"];
        const finalType = validTypes.includes(type) ? type : undefined;
        const validStatuses = ["published", "scheduled"];
        const finalStatus = validStatuses.includes(status) ? status : undefined;
        const scheduledAt = finalStatus === "scheduled" && scheduled_at
            ? new Date(scheduled_at).toISOString()
            : (scheduled_at ? new Date(scheduled_at).toISOString() : null);

        const result = await pool.query(
            `UPDATE events_news SET
                title = COALESCE($1, title),
                caption = COALESCE($2, caption),
                type = COALESCE($3, type),
                media_urls = $4,
                location = COALESCE($5, location),
                status = COALESCE($6, status),
                scheduled_at = COALESCE($7, scheduled_at),
                updated_at = NOW()
             WHERE id = $8
             RETURNING id, title, caption, type, media_urls, location, status, scheduled_at, published_at, created_by, created_at`,
            [
                title !== undefined ? (title.trim() || null) : null,
                caption?.trim() || null,
                finalType ?? null,
                mediaUrlsJson,
                location !== undefined ? location.trim() : null,
                finalStatus ?? null,
                scheduledAt,
                id,
            ]
        );

        const row = result.rows[0];
        await recordActivity(req, {
            action: "update",
            entity: "events_news",
            entity_id: row.id,
            summary: `Updated events & news post #${row.id}`,
        });

        res.json(shapeRow(row));
    } catch (err) {
        console.error("Error updating events & news post:", err.message);
        res.status(500).json({ error: "Failed to update post" });
    }
});

// ─── DELETE ────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { id } = req.params;
        const lookup = await pool.query("SELECT id FROM events_news WHERE id = $1", [id]);
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: "Post not found" });
        }

        await pool.query("DELETE FROM events_news WHERE id = $1", [id]);
        await recordActivity(req, {
            action: "delete",
            entity: "events_news",
            entity_id: Number(id),
            summary: `Deleted events & news post #${id}`,
        });
        res.json({ message: "Post deleted successfully" });
    } catch (err) {
        console.error("Error deleting events & news post:", err.message);
        res.status(500).json({ error: "Failed to delete post" });
    }
});

export default router;