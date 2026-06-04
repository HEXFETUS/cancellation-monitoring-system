import express from "express";
import pool from "../config/db.js";
import { blockRoles } from "../middleware/role-guard.js";
import { recordActivity } from "../utils/activity-log.js";

const router = express.Router();

const blockPurchaserDelete = blockRoles(["purchaser"], {
    errorMessage: "Purchasers can't delete asset codes",
});

// Note on `qr_payload`: previous schema had a separate qr_payload column on
// asset_codes that we'd encode into the printed QR sticker. The new
// asset_coding schema drops that column — the QR sticker now encodes the
// item_code directly. All scanning lookups go through item_code.
const COLUMNS = `
    id, item_code, description, type, department, care_of, space,
    asset_id, created_at, updated_at
`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
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
            `SELECT ${COLUMNS} FROM asset_coding ORDER BY id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/asset-codes error:", err.message);
        res.status(500).json({ error: "Failed to fetch asset codes" });
    }
});

// GET /api/asset-codes/by-item-code/:itemCode
// QR scanner endpoint. Decoded sticker text is the item_code itself
// (no qr_payload indirection). Trim and case-fold defensively so
// "01" and "1" don't both fail the lookup when the printer or scanner
// adds whitespace.
router.get("/by-item-code/:itemCode", async (req, res) => {
    const raw = String(req.params.itemCode || "").trim();
    if (!raw) {
        return res.status(400).json({ error: "EMPTY_ITEM_CODE" });
    }

    try {
        const result = await pool.query(
            `SELECT ${COLUMNS} FROM asset_coding WHERE item_code = $1 LIMIT 1`,
            [raw]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Item code not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET /api/asset-codes/by-item-code error:", err.message);
        res.status(500).json({ error: "Failed to look up asset code" });
    }
});

// POST /api/asset-codes
router.post("/", async (req, res) => {
    const validationError = validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const itemCode = req.body.itemCode.trim();

    try {
        const result = await pool.query(
            `
            INSERT INTO asset_coding
                (item_code, description, type, department, care_of, space, asset_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING ${COLUMNS}
            `,
            [
                itemCode,
                req.body.description.trim(),
                nullable(req.body.type),
                nullable(req.body.department),
                nullable(req.body.careOf),
                nullable(req.body.space),
                req.body.assetId ? Number(req.body.assetId) : null,
            ]
        );
        await recordActivity(req, {
            action: "create",
            entity: "asset_code",
            entity_id: result.rows[0].id,
            summary: `Created asset code ${result.rows[0].item_code}`,
        });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            // Postgres unique violation
            return res.status(409).json({
                error: "Item code already exists",
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
            UPDATE asset_coding
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
        await recordActivity(req, {
            action: "update",
            entity: "asset_code",
            entity_id: id,
            summary: `Updated asset code ${result.rows[0].item_code}`,
        });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Item code already exists" });
        }
        console.error("PUT /api/asset-codes/:id error:", err.message);
        res.status(500).json({ error: "Failed to update asset code" });
    }
});

// DELETE /api/asset-codes/:id
router.delete("/:id", blockPurchaserDelete, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            "DELETE FROM asset_coding WHERE id = $1 RETURNING id",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset code not found" });
        }
        await recordActivity(req, {
            action: "delete",
            entity: "asset_code",
            entity_id: id,
            summary: `Deleted asset code #${id}`,
        });
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE /api/asset-codes/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete asset code" });
    }
});

export default router;
