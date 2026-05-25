import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const VALID_LOCATIONS = new Set(["office", "payout", "drawcourt", "obs"]);

const ASSET_COLUMNS = `
    id,
    location,
    item_description,
    type,
    serial_number,
    department,
    space,
    date_purchase,
    vendor,
    purchase_price,
    warranty_date,
    quantity,
    discount,
    asset_value,
    total_value,
    color,
    remarks,
    created_at,
    updated_at
`;

function num(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function dateOrNull(value) {
    if (!value) return null;
    const s = String(value).trim();
    return s || null;
}

function validatePayload(body) {
    if (!body) return "Request body is required";
    if (!body.location || !VALID_LOCATIONS.has(body.location)) {
        return `Location must be one of: ${[...VALID_LOCATIONS].join(", ")}`;
    }
    if (!body.itemDescription?.trim()) {
        return "Item description is required";
    }
    return null;
}

function buildRow(body) {
    const quantity = Math.max(1, Math.floor(num(body.quantity, 1)));
    const purchasePrice = num(body.purchasePrice, 0);
    const discount = num(body.discount, 0);
    // If client did not provide assetValue, derive it: purchase_price - discount (clamped to 0).
    const assetValue =
        body.assetValue === undefined || body.assetValue === null || body.assetValue === ""
            ? Math.max(0, purchasePrice - discount)
            : num(body.assetValue, 0);
    // total_value always computed server-side to keep it consistent.
    const totalValue = assetValue * quantity;

    return {
        location: body.location,
        item_description: body.itemDescription.trim(),
        type: nullable(body.type),
        serial_number: nullable(body.serialNumber),
        department: nullable(body.department),
        space: nullable(body.space),
        date_purchase: dateOrNull(body.datePurchase),
        vendor: nullable(body.vendor),
        purchase_price: purchasePrice,
        warranty_date: dateOrNull(body.warrantyDate),
        quantity,
        discount,
        asset_value: assetValue,
        total_value: totalValue,
        color: nullable(body.color),
        remarks: nullable(body.remarks),
    };
}

// GET /api/assets?location=office
router.get("/", async (req, res) => {
    try {
        const { location } = req.query;

        if (location && !VALID_LOCATIONS.has(location)) {
            return res.status(400).json({
                error: `Location must be one of: ${[...VALID_LOCATIONS].join(", ")}`,
            });
        }

        const result = location
            ? await pool.query(
                `SELECT ${ASSET_COLUMNS} FROM assets WHERE location = $1 ORDER BY id DESC`,
                [location]
            )
            : await pool.query(`SELECT ${ASSET_COLUMNS} FROM assets ORDER BY id DESC`);

        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/assets error:", err.message);
        res.status(500).json({ error: "Failed to fetch assets" });
    }
});

// POST /api/assets
router.post("/", async (req, res) => {
    const validationError = validatePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const row = buildRow(req.body);

    try {
        const result = await pool.query(
            `
            INSERT INTO assets (
                location, item_description, type, serial_number, department, space,
                date_purchase, vendor, purchase_price, warranty_date, quantity,
                discount, asset_value, total_value, color, remarks
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING ${ASSET_COLUMNS}
            `,
            [
                row.location,
                row.item_description,
                row.type,
                row.serial_number,
                row.department,
                row.space,
                row.date_purchase,
                row.vendor,
                row.purchase_price,
                row.warranty_date,
                row.quantity,
                row.discount,
                row.asset_value,
                row.total_value,
                row.color,
                row.remarks,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("POST /api/assets error:", err.message);
        res.status(500).json({ error: "Failed to create asset" });
    }
});

// PUT /api/assets/:id
router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const validationError = validatePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const row = buildRow(req.body);

    try {
        const result = await pool.query(
            `
            UPDATE assets
            SET location = $1,
                item_description = $2,
                type = $3,
                serial_number = $4,
                department = $5,
                space = $6,
                date_purchase = $7,
                vendor = $8,
                purchase_price = $9,
                warranty_date = $10,
                quantity = $11,
                discount = $12,
                asset_value = $13,
                total_value = $14,
                color = $15,
                remarks = $16,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $17
            RETURNING ${ASSET_COLUMNS}
            `,
            [
                row.location,
                row.item_description,
                row.type,
                row.serial_number,
                row.department,
                row.space,
                row.date_purchase,
                row.vendor,
                row.purchase_price,
                row.warranty_date,
                row.quantity,
                row.discount,
                row.asset_value,
                row.total_value,
                row.color,
                row.remarks,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("PUT /api/assets/:id error:", err.message);
        res.status(500).json({ error: "Failed to update asset" });
    }
});

// DELETE /api/assets/:id
router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query("DELETE FROM assets WHERE id = $1 RETURNING id", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE /api/assets/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete asset" });
    }
});

export default router;
