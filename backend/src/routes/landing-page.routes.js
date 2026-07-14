import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pool from "../config/db.js";
import { recordActivity } from "../utils/activity-log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    limits: { fileSize: 10 * 1024 * 1024 },
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

function getUserId(req) {
    return req.body?.user_id ?? req.query?.user_id ?? req.headers?.["x-user-id"];
}

// GET /api/landing-page/:section - Get content for a specific section
router.get("/:section", async (req, res) => {
    try {
        const { section } = req.params;
        const validSections = ["home", "social-responsibility", "about-us"];
        if (!validSections.includes(section)) {
            return res.status(400).json({ error: "Invalid section" });
        }

        const result = await pool.query(
            `SELECT id, section, title, description, content, image_urls, stats, created_at, updated_at
             FROM landing_page_content
             WHERE section = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [section]
        );

        if (result.rows.length === 0) {
            return res.json(null);
        }

        const row = result.rows[0];
        res.json({
            ...row,
            image_urls: row.image_urls ? JSON.parse(row.image_urls) : [],
            stats: row.stats ? JSON.parse(row.stats) : null,
        });
    } catch (err) {
        console.error("Error fetching landing page content:", err.message);
        res.status(500).json({ error: "Failed to fetch content" });
    }
});

// PUT /api/landing-page/:section - Update content for a section
router.put("/:section", upload.array("images", 10), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "User ID is required" });
        }

        const { section } = req.params;
        const validSections = ["home", "social-responsibility", "about-us"];
        if (!validSections.includes(section)) {
            return res.status(400).json({ error: "Invalid section" });
        }

        const { title, description, content, stats } = req.body;

        // Build image URLs array from uploaded files
        const newImageUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
        let imageUrlsJson = JSON.stringify(newImageUrls);

        // If existing images are provided, merge them
        if (req.body.existing_images) {
            try {
                const existing = JSON.parse(req.body.existing_images);
                imageUrlsJson = JSON.stringify([...existing, ...newImageUrls]);
            } catch {
                // use new images only
            }
        }

        // Parse stats JSON if provided
        let statsJson = null;
        if (req.body.stats) {
            try {
                statsJson = JSON.stringify(req.body.stats);
            } catch {
                statsJson = null;
            }
        }

        // Check if section exists
        const existing = await pool.query(
            "SELECT id FROM landing_page_content WHERE section = $1",
            [section]
        );

        let result;
        if (existing.rows.length > 0) {
            // Update existing
            result = await pool.query(
                `UPDATE landing_page_content SET
                    title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    content = COALESCE($3, content),
                    image_urls = COALESCE($4, image_urls),
                    stats = COALESCE($5, stats),
                    updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [
                    title?.trim() || null,
                    description?.trim() || null,
                    content?.trim() || null,
                    imageUrlsJson,
                    stats || null,
                    existing.rows[0].id,
                ]
            );
        } else {
            // Create new
            result = await pool.query(
                `INSERT INTO landing_page_content (section, title, description, content, image_urls, stats, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [
                    section,
                    title?.trim() || null,
                    description?.trim() || null,
                    content?.trim() || null,
                    imageUrlsJson,
                    stats || null,
                    userId,
                ]
            );
        }

        const row = result.rows[0];
        await recordActivity(req, {
            action: existing.rows.length > 0 ? "update" : "create",
            entity: "landing_page_content",
            entity_id: row.id,
            summary: `Updated ${section} section`,
        });

        res.json({
            ...row,
            image_urls: row.image_urls ? JSON.parse(row.image_urls) : [],
            stats: row.stats ? JSON.parse(row.stats) : null,
        });
    } catch (err) {
        console.error("Error updating landing page content:", err.message);
        res.status(500).json({ error: "Failed to update content" });
    }
});

// DELETE /api/landing-page/:section/image - Remove an image from a section
router.delete("/:section/image", async (req, res) => {
    try {
        const { section } = req.params;
        const { image_url } = req.body;

        const result = await pool.query(
            "SELECT id, image_urls FROM landing_page_content WHERE section = $1",
            [section]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Section not found" });
        }

        const current = result.rows[0];
        const images = current.image_urls ? JSON.parse(current.image_urls) : [];
        const filtered = images.filter((url) => url !== image_url);

        await pool.query(
            "UPDATE landing_page_content SET image_urls = $1, updated_at = NOW() WHERE id = $2",
            [JSON.stringify(filtered), current.id]
        );

        res.json({ message: "Image removed" });
    } catch (err) {
        console.error("Error removing image:", err.message);
        res.status(500).json({ error: "Failed to remove image" });
    }
});

export default router;