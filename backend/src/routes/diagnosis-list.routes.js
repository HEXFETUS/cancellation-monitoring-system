import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const COLUMNS = `id, name, created_at, updated_at`;

async function syncDiagnosisListSequence() {
    await pool.query(`
        SELECT setval(
            pg_get_serial_sequence('diagnosis_list', 'id'),
            COALESCE((SELECT MAX(id) FROM diagnosis_list), 0) + 1,
            false
        );
    `);
}

async function insertDiagnosis(name) {
    const result = await pool.query(
        `INSERT INTO diagnosis_list (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING ${COLUMNS}`,
        [name.trim()]
    );

    return result.rows[0];
}

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

// POST /api/diagnosis-list — create a new diagnosis entry
router.post("/", async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    try {
        const row = await insertDiagnosis(name);
        res.status(201).json(row);
    } catch (err) {
        if (err.code === "23505") {
            try {
                await syncDiagnosisListSequence();
                const row = await insertDiagnosis(name);
                return res.status(201).json(row);
            } catch (retryErr) {
                console.error("POST diagnosis_list retry error:", retryErr.message);
            }
        }

        console.error("POST diagnosis_list error:", err.message);
        res.status(500).json({ error: "Failed to create diagnosis entry" });
    }
});

// PUT /api/diagnosis-list/:id — update a diagnosis entry
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    try {
        const result = await pool.query(
            `UPDATE diagnosis_list SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING ${COLUMNS}`,
            [name.trim(), id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Diagnosis entry not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PUT diagnosis_list error:", err.message);
        res.status(500).json({ error: "Failed to update diagnosis entry" });
    }
});

// DELETE /api/diagnosis-list/:id — delete a diagnosis entry
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM diagnosis_list WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Diagnosis entry not found" });
        }
        res.json({ message: "Diagnosis entry deleted successfully" });
    } catch (err) {
        console.error("DELETE diagnosis_list error:", err.message);
        res.status(500).json({ error: "Failed to delete diagnosis entry" });
    }
});

export default router;
