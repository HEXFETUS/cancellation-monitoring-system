import express from "express";
import crypto from "node:crypto";
import pool from "../config/db.js";

const router = express.Router();

const COLUMNS = `
    id, item_code, description, type, department, care_of, space,
    qr_payload, asset_id, created_at, updated_at
`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function generateQrPayload(itemCode) {
    // Stable, scannable, unique. Format: ASSET-{ITEM_CODE}-{rand}
    // Random suffix prevents collisions if two rows ever share an item_code accidentally.
    const code = String(itemCode || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    return code ? `ASSET-${code}-${suffix}` : `ASSET-${suffix}`;
}

function validate(body) {
    if (!body) return "Request body is required";
    if (!body.itemCode?.trim()) return "Item code is required";
    if (!body.description?.trim()) return "Description is required";
    return null;
}

// GET /api/asset-codes
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM asset_codes ORDER BY id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/asset-codes error:", err.message);
        res.status(500).json({ error: "Failed to fetch asset codes" });
    }
});

// GET /api/asset-codes/by-payload/:payload
// Useful for a future "scan to look up" feature.
router.get("/by-payload/:payload", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM asset_codes WHERE qr_payload = $1 LIMIT 1`,
            [req.params.payload]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "QR payload not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET /api/asset-codes/by-payload error:", err.message);
        res.status(500).json({ error: "Failed to look up asset code" });
    }
});

// POST /api/asset-codes
router.post("/", async (req, res) => {
    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const itemCode = req.body.itemCode.trim();
    // If client supplies a qrPayload, respect it; otherwise generate one.
    const qrPayload =
        nullable(req.body.qrPayload) ?? generateQrPayload(itemCode);

    try {
        const result = await pool.query(
            `
            INSERT INTO asset_codes
                (item_code, description, type, department, care_of, space, qr_payload, asset_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING ${COLUMNS}
            `,
            [
                itemCode,
                req.body.description.trim(),
                nullable(req.body.type),
                nullable(req.body.department),
                nullable(req.body.careOf),
                nullable(req.body.space),
                qrPayload,
                req.body.assetId ? Number(req.body.assetId) : null,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            // Postgres unique violation
            return res.status(409).json({
                error: "Item code or QR payload already exists",
            });
        }
        console.error("POST /api/asset-codes error:", err.message);
        res.status(500).json({ error: "Failed to create asset code" });
    }
});

// PUT /api/asset-codes/:id
router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const result = await pool.query(
            `
            UPDATE asset_codes
            SET item_code = $1,
                description = $2,
                type = $3,
                department = $4,
                care_of = $5,
                space = $6,
                asset_id = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING ${COLUMNS}
            `,
            [
                req.body.itemCode.trim(),
                req.body.description.trim(),
                nullable(req.body.type),
                nullable(req.body.department),
                nullable(req.body.careOf),
                nullable(req.body.space),
                req.body.assetId ? Number(req.body.assetId) : null,
                id,
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset code not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Item code already exists" });
        }
        console.error("PUT /api/asset-codes/:id error:", err.message);
        res.status(500).json({ error: "Failed to update asset code" });
    }
});

// POST /api/asset-codes/:id/regenerate-qr
// Mints a fresh qr_payload (e.g. when a printed sticker is lost or compromised).
router.post("/:id/regenerate-qr", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const existing = await pool.query(
            "SELECT item_code FROM asset_codes WHERE id = $1",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Asset code not found" });
        }

        const newPayload = generateQrPayload(existing.rows[0].item_code);

        const result = await pool.query(
            `
            UPDATE asset_codes
            SET qr_payload = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING ${COLUMNS}
            `,
            [newPayload, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("POST regenerate-qr error:", err.message);
        res.status(500).json({ error: "Failed to regenerate QR payload" });
    }
});

// DELETE /api/asset-codes/:id
router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            "DELETE FROM asset_codes WHERE id = $1 RETURNING id",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset code not found" });
        }
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE /api/asset-codes/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete asset code" });
    }
});

export default router;
