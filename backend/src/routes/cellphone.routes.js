import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const COLUMNS = `id, brand, model, specs, serial_number, imei1, imei2, control_no, operator_id, added_by_user_id, status, booth_id, created_at, updated_at`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function validate(body) {
    if (!body) return "Request body is required";
    if (!body.brand?.trim()) return "Brand is required";
    if (!body.model?.trim()) return "Model is required";
    if (!body.specs?.trim()) return "Specs is required";
    if (!body.serialNumber?.trim()) return "Serial number is required";
    if (!body.controlNo?.trim()) return "Control number is required";
    if (!body.imei1?.trim() && !body.imei2?.trim()) return "At least one IMEI (IMEI1 or IMEI2) is required";
    return null;
}

// GET /api/cellphones
router.get("/", async (req, res) => {
    try {
        const { operator_id } = req.query;
        let query = `SELECT ${COLUMNS} FROM cellphone_list`;
        const params = [];

        if (operator_id) {
            params.push(Number(operator_id));
            query += ` WHERE operator_id = $1`;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("GET cellphone_list error:", err.message);
        res.status(500).json({ error: "Failed to fetch cellphones" });
    }
});

// GET /api/cellphones/:id
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM cellphone_list WHERE id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cellphone not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET cellphone_list/:id error:", err.message);
        res.status(500).json({ error: "Failed to fetch cellphone" });
    }
});

// POST /api/cellphones
router.post("/", async (req, res) => {
    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const result = await pool.query(
            `
INSERT INTO cellphone_list (brand, model, specs, serial_number, imei1, imei2, control_no, operator_id, added_by_user_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${COLUMNS}
            `,
            [
                req.body.brand.trim(),
                req.body.model.trim(),
                req.body.specs.trim(),
                req.body.serialNumber.trim(),
                nullable(req.body.imei1),
                nullable(req.body.imei2),
                req.body.controlNo.trim(),
                req.body.operatorId ?? null,
                req.body.addedByUserId ?? null,
                req.body.status ?? 'Inactive',
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Control number already exists" });
        }
        console.error("POST cellphone_list error:", err.message);
        res.status(500).json({ error: "Failed to create cellphone record" });
    }
});

// PUT /api/cellphones/:id
router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const result = await pool.query(
            `
            UPDATE cellphone_list
            SET brand = $1,
                model = $2,
                specs = $3,
                serial_number = $4,
                imei1 = $5,
                imei2 = $6,
                control_no = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING ${COLUMNS}
            `,
            [
                req.body.brand.trim(),
                req.body.model.trim(),
                req.body.specs.trim(),
                req.body.serialNumber.trim(),
                nullable(req.body.imei1),
                nullable(req.body.imei2),
                req.body.controlNo.trim(),
                id,
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cellphone not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Control number already exists" });
        }
        console.error("PUT cellphone_list error:", err.message);
        res.status(500).json({ error: "Failed to update cellphone record" });
    }
});

// DELETE /api/cellphones/:id
router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            "DELETE FROM cellphone_list WHERE id = $1 RETURNING id",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cellphone not found" });
        }
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE cellphone_list error:", err.message);
        res.status(500).json({ error: "Failed to delete cellphone record" });
    }
});

export default router;