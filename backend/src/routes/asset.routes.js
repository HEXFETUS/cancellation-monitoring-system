import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import { blockRoles } from "../middleware/role-guard.js";
import { recordActivity } from "../utils/activity-log.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the shared uploads directory served by /uploads.
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Asset media uploader — same accepted types and size limits as the
// announcements/posts uploader so users get a consistent experience.
const mediaStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `asset-${uniqueSuffix}${ext}`);
    },
});

const mediaUpload = multer({
    storage: mediaStorage,
    limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // generous: 25 MB per file
    fileFilter: (_req, file, cb) => {
        const allowedExt = /\.(jpe?g|png|mp4)$/i;
        const allowedMime = /^(image\/(jpe?g|png)|video\/mp4)$/i;
        if (allowedExt.test(file.originalname) && allowedMime.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("ATTACHMENT_TYPE_REJECTED"));
    },
});

const blockPurchaserDelete = blockRoles(["purchaser"], {
    errorMessage: "Purchasers can't delete assets",
});

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
    payout_station_id,
    office_department_id,
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
        payout_station_id:
            body.payoutStationId === undefined ||
                body.payoutStationId === null ||
                body.payoutStationId === ""
                ? null
                : Number(body.payoutStationId),
        office_department_id:
            body.officeDepartmentId === undefined ||
                body.officeDepartmentId === null ||
                body.officeDepartmentId === ""
                ? null
                : Number(body.officeDepartmentId),
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
                discount, asset_value, total_value, color, remarks, payout_station_id,
                office_department_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
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
                row.payout_station_id,
                row.office_department_id,
            ]
        );

        const created = result.rows[0];
        await recordActivity(req, {
            action: "create",
            entity: "asset",
            entity_id: created.id,
            summary: `Created asset "${created.item_description}" (${created.location})`,
        });
        res.status(201).json(created);
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
                payout_station_id = $17,
                office_department_id = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $19
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
                row.payout_station_id,
                row.office_department_id,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }

        const updated = result.rows[0];
        await recordActivity(req, {
            action: "update",
            entity: "asset",
            entity_id: updated.id,
            summary: `Updated asset "${updated.item_description}"`,
        });
        res.json(updated);
    } catch (err) {
        console.error("PUT /api/assets/:id error:", err.message);
        res.status(500).json({ error: "Failed to update asset" });
    }
});

// DELETE /api/assets/:id
router.delete("/:id", blockPurchaserDelete, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query("DELETE FROM assets WHERE id = $1 RETURNING id", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }
        await recordActivity(req, {
            action: "delete",
            entity: "asset",
            entity_id: id,
            summary: `Deleted asset #${id}`,
        });
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error("DELETE /api/assets/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete asset" });
    }
});

// PATCH /api/assets/:id/remarks — update just the remarks field. Used by
// the QR-scan flow on the purchaser side so they don't need to re-send the
// full asset payload via the existing PUT endpoint.
router.patch("/:id/remarks", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const trimmed =
        req.body?.remarks === null || req.body?.remarks === undefined
            ? null
            : String(req.body.remarks).trim() || null;

    try {
        const result = await pool.query(
            `UPDATE assets
             SET remarks = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int
             RETURNING ${ASSET_COLUMNS}`,
            [trimmed, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }
        await recordActivity(req, {
            action: "update",
            entity: "asset_remarks",
            entity_id: id,
            summary: `Updated remarks on asset #${id}`,
        });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PATCH /api/assets/:id/remarks error:", err.message);
        res.status(500).json({ error: "Failed to update remarks" });
    }
});

// GET /api/assets/:id/media — list media attached to a specific asset,
// newest first. Joined with users so the UI can show who uploaded each one.
router.get("/:id/media", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const result = await pool.query(
            `SELECT m.id, m.asset_id, m.url, m.mime_type, m.caption, m.created_at,
                    m.uploaded_by,
                    u.name AS uploaded_by_name
             FROM asset_media m
             LEFT JOIN users u ON u.id = m.uploaded_by
             WHERE m.asset_id = $1::int
             ORDER BY m.created_at DESC, m.id DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/assets/:id/media error:", err.message);
        res.status(500).json({ error: "Failed to fetch asset media" });
    }
});

// POST /api/assets/:id/media — upload one or more media files for an asset.
// Accepts the multipart field name `media` (multiple). Optional `caption`
// applies to every file in the batch. `user_id` body field captures who
// did the upload so the gallery can show "uploaded by X".
router.post("/:id/media", mediaUpload.array("media", 10), async (req, res) => {
    const cleanupUploaded = () => {
        for (const f of req.files ?? []) {
            fs.unlink(path.join(uploadsDir, f.filename), () => {});
        }
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        cleanupUploaded();
        return res.status(400).json({ error: "Invalid id" });
    }

    const files = req.files ?? [];
    if (files.length === 0) {
        return res.status(400).json({ error: "At least one file is required" });
    }

    try {
        const exists = await pool.query(
            "SELECT id FROM assets WHERE id = $1::int",
            [id]
        );
        if (exists.rows.length === 0) {
            cleanupUploaded();
            return res.status(404).json({ error: "Asset not found" });
        }

        const caption = nullable(req.body?.caption);
        const userIdRaw = req.body?.user_id;
        const userId = userIdRaw ? Number(userIdRaw) : null;

        const inserted = [];
        for (const f of files) {
            const url = `/uploads/${f.filename}`;
            const result = await pool.query(
                `INSERT INTO asset_media (asset_id, url, mime_type, uploaded_by, caption)
                 VALUES ($1::int, $2, $3, $4, $5)
                 RETURNING id, asset_id, url, mime_type, caption, created_at, uploaded_by`,
                [id, url, f.mimetype || null, Number.isFinite(userId) ? userId : null, caption]
            );
            inserted.push(result.rows[0]);
        }

        await recordActivity(req, {
            action: "upload",
            entity: "asset_media",
            entity_id: id,
            summary: `Uploaded ${inserted.length} media file${inserted.length === 1 ? "" : "s"} to asset #${id}`,
        });

        res.status(201).json(inserted);
    } catch (err) {
        cleanupUploaded();
        if (err && err.message === "ATTACHMENT_TYPE_REJECTED") {
            return res.status(400).json({ error: "ATTACHMENT_TYPE_REJECTED" });
        }
        if (err && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "ATTACHMENT_TOO_LARGE" });
        }
        console.error("POST /api/assets/:id/media error:", err.message);
        res.status(500).json({ error: "Failed to upload media" });
    }
});

// DELETE /api/assets/:assetId/media/:mediaId — remove a single media row.
// Best-effort cleans up the file on disk too. Same role gating as
// asset deletion so purchasers can't wipe records they didn't create.
router.delete("/:assetId/media/:mediaId", blockPurchaserDelete, async (req, res) => {
    const assetId = Number(req.params.assetId);
    const mediaId = Number(req.params.mediaId);
    if (!Number.isFinite(assetId) || !Number.isFinite(mediaId)) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const lookup = await pool.query(
            "SELECT id, url FROM asset_media WHERE id = $1::int AND asset_id = $2::int",
            [mediaId, assetId]
        );
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: "Media not found" });
        }

        await pool.query("DELETE FROM asset_media WHERE id = $1::int", [mediaId]);

        const url = lookup.rows[0].url;
        if (typeof url === "string" && url.startsWith("/uploads/")) {
            fs.unlink(path.join(uploadsDir, path.basename(url)), () => {});
        }

        await recordActivity(req, {
            action: "delete",
            entity: "asset_media",
            entity_id: mediaId,
            summary: `Removed media from asset #${assetId}`,
        });

        res.json({ id: mediaId });
    } catch (err) {
        console.error("DELETE asset media error:", err.message);
        res.status(500).json({ error: "Failed to delete media" });
    }
});

export default router;
