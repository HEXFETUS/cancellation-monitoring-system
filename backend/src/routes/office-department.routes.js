import express from "express";
import pool from "../config/db.js";
import { blockRoles } from "../middleware/role-guard.js";

const router = express.Router();

const blockPurchaserDelete = blockRoles(["purchaser"], {
    errorMessage: "Purchasers can't delete office departments",
});

const COLUMNS = `id, dept_code, name, description, active, created_at, updated_at`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function validate(body) {
    if (!body) return "Request body is required";
    if (!body.deptCode?.trim()) return "Department code is required";
    if (!body.name?.trim()) return "Name is required";
    return null;
}

// GET /api/office-departments
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM office_departments ORDER BY dept_code ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET office_departments error:", err.message);
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});

// POST /api/office-departments
router.post("/", async (req, res) => {
    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const result = await pool.query(
            `
            INSERT INTO office_departments (dept_code, name, description, active)
            VALUES ($1, $2, $3, COALESCE($4, true))
            RETURNING ${COLUMNS}
            `,
            [
                req.body.deptCode.trim(),
                req.body.name.trim(),
                nullable(req.body.description),
                req.body.active,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Department code already exists" });
        }
        console.error("POST office_departments error:", err.message);
        res.status(500).json({ error: "Failed to create department" });
    }
});

// PUT /api/office-departments/:id
router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const result = await pool.query(
            `
            UPDATE office_departments
            SET dept_code = $1,
                name = $2,
                description = $3,
                active = COALESCE($4, active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING ${COLUMNS}
            `,
            [
                req.body.deptCode.trim(),
                req.body.name.trim(),
                nullable(req.body.description),
                req.body.active,
                id,
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Department code already exists" });
        }
        console.error("PUT office_departments error:", err.message);
        res.status(500).json({ error: "Failed to update department" });
    }
});

// DELETE /api/office-departments/:id
router.delete("/:id", blockPurchaserDelete, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            "DELETE FROM office_departments WHERE id = $1 RETURNING id",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE office_departments error:", err.message);
        res.status(500).json({ error: "Failed to delete department" });
    }
});

export default router;
