import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
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
        // Only JPG, PNG, and MP4 are accepted. The accept set used to be
        // wider (gif/webp/mov/avi/pdf) but the product narrowed it; keeping
        // those would cause broken-image renders on the landing page since
        // those types either don't decode in <img> or aren't <video>-friendly.
        const allowedExt = /\.(jpe?g|png|mp4)$/i;
        const allowedMime = /^(image\/(jpe?g|png)|video\/mp4)$/i;
        if (allowedExt.test(file.originalname) && allowedMime.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("Only .jpg, .png, and .mp4 files are allowed"));
    },
});

const router = express.Router();

// Helper: get user ID from request (matches auth pattern)
function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

// ─── LOTTERY RESULTS ──────────────────────────────────────────────

// GET /api/posts/results — public, returns last 3 days of results
router.get("/results", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, draw_label, winning_number, area, draw_date, game_type, created_at
             FROM lottery_results
             WHERE draw_date >= CURRENT_DATE - INTERVAL '3 days'
             ORDER BY draw_date DESC, id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching lottery results:", err.message);
        res.status(500).json({ error: "Failed to fetch results" });
    }
});

// POST /api/posts/results — CSR only, create a result
router.post("/results", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { draw_label, winning_number, area, draw_date, game_type } = req.body;
        if (!draw_label?.trim() || !winning_number?.trim() || !area?.trim()) {
            return res.status(400).json({ error: "draw_label, winning_number, and area are required" });
        }

        const validAreas = ["National", "Local CDO", "Local MISOR"];
        if (!validAreas.includes(area)) {
            return res.status(400).json({ error: `area must be one of: ${validAreas.join(", ")}` });
        }

        const validGameTypes = ["STL", "3D"];
        const finalGameType = validGameTypes.includes(game_type) ? game_type : "STL";

        const result = await pool.query(
            `INSERT INTO lottery_results (draw_label, winning_number, area, draw_date, game_type, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, draw_label, winning_number, area, draw_date, game_type, created_at`,
            [draw_label.trim(), winning_number.trim(), area, draw_date || new Date().toISOString().split("T")[0], finalGameType, userId]
        );

        const created = result.rows[0];
        await recordActivity(req, {
            action: "create",
            entity: "lottery_result",
            entity_id: created.id,
            summary: `Posted lottery result: ${created.draw_label} (${created.area})`,
        });

        res.status(201).json(created);
    } catch (err) {
        console.error("Error creating result:", err.message);
        res.status(500).json({ error: "Failed to create result" });
    }
});

// DELETE /api/posts/results/:id — CSR only
router.delete("/results/:id", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { id } = req.params;
        await pool.query("DELETE FROM lottery_results WHERE id = $1", [id]);
        await recordActivity(req, {
            action: "delete",
            entity: "lottery_result",
            entity_id: Number(id),
            summary: `Deleted lottery result #${id}`,
        });
        res.json({ message: "Result deleted successfully" });
    } catch (err) {
        console.error("Error deleting result:", err.message);
        res.status(500).json({ error: "Failed to delete result" });
    }
});

// ─── ANNOUNCEMENTS (Events & News) ────────────────────────────────

// GET /api/posts/announcements — public
router.get("/announcements", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, caption, type, media_urls, location, created_by, created_at
             FROM announcements
             ORDER BY created_at DESC`
        );
        // Parse media_urls from JSON string
        const rows = result.rows.map((row) => ({
            ...row,
            media_urls: JSON.parse(row.media_urls || "[]"),
        }));
        res.json(rows);
    } catch (err) {
        console.error("Error fetching announcements:", err.message);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
});

// POST /api/posts/announcements — CSR only, create announcement with optional media upload
router.post("/announcements", upload.array("media", 5), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { title, caption, type, location } = req.body;
        if (!title?.trim() || !type?.trim()) {
            return res.status(400).json({ error: "title and type are required" });
        }

        const validTypes = ["event", "news"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
        }

        // Build media URLs array
        const mediaUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
        const mediaUrlsJson = JSON.stringify(mediaUrls);

        const result = await pool.query(
            `INSERT INTO announcements (title, caption, type, media_urls, location, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, title, caption, type, media_urls, location, created_by, created_at`,
            [title.trim(), caption?.trim() || "", type, mediaUrlsJson, location?.trim() || "", userId]
        );

        const row = result.rows[0];
        await recordActivity(req, {
            action: "create",
            entity: "announcement",
            entity_id: row.id,
            summary: `Posted ${row.type}: ${row.title}`,
        });
        res.status(201).json({
            ...row,
            media_urls: JSON.parse(row.media_urls),
        });
    } catch (err) {
        console.error("Error creating announcement:", err.message);
        res.status(500).json({ error: "Failed to create announcement" });
    }
});

// DELETE /api/posts/announcements/:id — CSR only
router.delete("/announcements/:id", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { id } = req.params;
        await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
        await recordActivity(req, {
            action: "delete",
            entity: "announcement",
            entity_id: Number(id),
            summary: `Deleted announcement #${id}`,
        });
        res.json({ message: "Announcement deleted successfully" });
    } catch (err) {
        console.error("Error deleting announcement:", err.message);
        res.status(500).json({ error: "Failed to delete announcement" });
    }
});

export default router;