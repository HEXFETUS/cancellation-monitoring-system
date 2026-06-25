import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ error: "user_id is required" });

        const result = await pool.query(
            `SELECT 
                a.*,
                u.name as created_by_name
             FROM admin_announcements a
             LEFT JOIN users u ON u.id = a.created_by
             ORDER BY 
                COALESCE(a.published_at, a.scheduled_at, a.created_at) DESC`
        );
        res.json({ announcements: result.rows });
    } catch (err) {
        console.error("getAdminAnnouncements error:", err);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
});

router.get("/view", async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ error: "user_id is required" });

        const result = await pool.query(
            `SELECT 
                a.*,
                u.name as created_by_name,
                COALESCE(a.published_at, a.scheduled_at, a.created_at) as visible_at
             FROM admin_announcements a
             LEFT JOIN users u ON u.id = a.created_by
             WHERE 
                a.status = 'published'
                OR (a.status = 'scheduled' AND a.scheduled_at <= NOW())
             ORDER BY visible_at DESC`
        );
        res.json({ announcements: result.rows });
    } catch (err) {
        console.error("getVisibleAdminAnnouncements error:", err);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, scheduled_at } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: "Title and description are required" });
        }

        if (status !== "published" && status !== "scheduled") {
            return res.status(400).json({ error: "Status must be published or scheduled" });
        }

        if (status === "scheduled" && !scheduled_at) {
            return res.status(400).json({ error: "scheduled_at is required when status is scheduled" });
        }

        const result = await pool.query(
            `UPDATE admin_announcements 
             SET title = $1, description = $2, status = $3, scheduled_at = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [title, description, status, scheduled_at, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Announcement not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("updateAdminAnnouncement error:", err);
        res.status(500).json({ error: "Failed to update announcement" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM admin_announcements WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Announcement not found" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("deleteAdminAnnouncement error:", err);
        res.status(500).json({ error: "Failed to delete announcement" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { title, description, status, scheduled_at, created_by } = req.body;

        if (!title || !description || !created_by) {
            return res.status(400).json({ error: "Title, description, and created_by are required" });
        }

        if (status !== "published" && status !== "scheduled") {
            return res.status(400).json({ error: "Status must be published or scheduled" });
        }

        if (status === "scheduled" && !scheduled_at) {
            return res.status(400).json({ error: "scheduled_at is required when status is scheduled" });
        }

        const result = await pool.query(
            `INSERT INTO admin_announcements 
                (title, description, status, scheduled_at, published_at, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
            [
                title,
                description,
                status,
                scheduled_at,
                status === "published" ? new Date().toISOString() : null,
                created_by,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("createAdminAnnouncement error:", err);
        res.status(500).json({ error: "Failed to create announcement" });
    }
});

export default router;