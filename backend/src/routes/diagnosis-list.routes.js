import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const COLUMNS = `id, name, created_at, updated_at`;

// GET /api/diagnosis-list — returns diagnoses for dropdown use
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM diagnosis_list ORDER BY name ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET diagnosis_list error:", err.message);
        res.status(500).json({ error: "Failed to fetch diagnoses" });
    }
});

// GET /api/diagnosis-list/all — returns all diagnoses (including inactive) for admin management
router.get("/all", async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM diagnosis_list ORDER BY name ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET diagnosis_list/all error:", err.message);
        res.status(500).json({ error: "Failed to fetch diagnoses" });
    }
});

export default router;
