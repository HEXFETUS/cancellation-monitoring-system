import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const SELECT_COLUMNS = `
    SELECT
        bcr.id,
        bcr.pos_record_id,
        bcr.requested_by_user_id,
        bcr.requested_booth_id,
        bcr.reason,
        bcr.status,
        bcr.admin_user_id,
        bcr.admin_notes,
        bcr.decided_at,
        bcr.created_at,
        bcr.updated_at,
        p.device_no,
        p.serial_number,
        p.booth_id AS current_booth_id,
        cb.booth_code AS current_booth_code,
        rb.booth_code AS requested_booth_code,
        ru.name AS requested_by_name,
        au.name AS admin_name
    FROM booth_change_requests bcr
    LEFT JOIN pos_records p ON bcr.pos_record_id = p.id
    LEFT JOIN booth_info cb ON p.booth_id = cb.id
    LEFT JOIN booth_info rb ON bcr.requested_booth_id = rb.id
    LEFT JOIN users ru ON bcr.requested_by_user_id = ru.id
    LEFT JOIN users au ON bcr.admin_user_id = au.id
`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

// Returns the current time in Asia/Manila formatted as a PostgreSQL
// TIMESTAMP string ("YYYY-MM-DD HH:MM:SS"). Used when creating new rows so
// the displayed "Submitted" timestamp matches the local time the operator
// is in, regardless of the database session timezone.
function manilaTimestamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * GET /api/booth-change-requests
 * Query params:
 *   status=pending|approved|rejected|cancelled
 *   userId=<id>           (operator views their own; admin can pass any id)
 *   pos_record_id=<id>    (filter by a single POS device)
 */
router.get("/", async (req, res) => {
    try {
        const { status, userId, pos_record_id } = req.query;
        const conditions = [];
        const params = [];

        if (status) {
            params.push(String(status));
            conditions.push(`bcr.status = $${params.length}`);
        }
        if (userId) {
            params.push(Number(userId));
            conditions.push(`bcr.requested_by_user_id = $${params.length}`);
        }
        if (pos_record_id) {
            params.push(Number(pos_record_id));
            conditions.push(`bcr.pos_record_id = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `${SELECT_COLUMNS} ${where} ORDER BY bcr.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET booth-change-requests error:", err.message);
        res.status(500).json({ error: "Failed to fetch booth change requests" });
    }
});

/**
 * POST /api/booth-change-requests
 * Body: { pos_record_id, requested_booth_id, requested_by_user_id, reason? }
 * Operator submits a booth change request for one of their POS devices.
 */
router.post("/", async (req, res) => {
    const { pos_record_id, requested_booth_id, requested_by_user_id, reason } = req.body ?? {};

    if (!pos_record_id || !requested_booth_id) {
        return res.status(400).json({
            error: "pos_record_id and requested_booth_id are required",
        });
    }

    try {
        // Reject if there's already a pending request for the same device.
        const existing = await pool.query(
            `SELECT id FROM booth_change_requests
             WHERE pos_record_id = $1 AND status = 'pending' LIMIT 1`,
            [pos_record_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "A pending request already exists for this POS device",
            });
        }

        // Validate that the POS device and target booth belong to the same
        // operator (operator boundary rule). Also derive the device's area
        // to give a helpful error message when the mismatch is clear.
        const posResult = await pool.query(
            `SELECT id, device_no, area, operator_id
             FROM pos_records WHERE id = $1::int LIMIT 1`,
            [pos_record_id]
        );
        if (posResult.rows.length === 0) {
            return res.status(404).json({ error: "POS device not found" });
        }
        const pos = posResult.rows[0];

        const boothResult = await pool.query(
            `SELECT id, booth_code, operator_id
             FROM booth_info WHERE id = $1::int LIMIT 1`,
            [requested_booth_id]
        );
        if (boothResult.rows.length === 0) {
            return res.status(404).json({ error: "Target booth not found" });
        }
        const targetBooth = boothResult.rows[0];

        // Enforce same-operator-family rule.
        //
        // A "family" is the main operator plus all its subs. We compute the
        // root for both the device's operator and the target booth's
        // operator, then require them to match. This lets a sub-operator
        // request a change to any booth in the same main, and lets a main
        // request changes across its subs — but never across two unrelated
        // mains.
        if (pos.operator_id && targetBooth.operator_id) {
            const familyResult = await pool.query(
                `SELECT id, COALESCE(parent_operator_id, id) AS root_id
                 FROM operator_list
                 WHERE id = $1::int OR id = $2::int`,
                [pos.operator_id, targetBooth.operator_id]
            );
            const map = new Map(
                familyResult.rows.map((row) => [Number(row.id), Number(row.root_id)])
            );
            const posRoot = map.get(Number(pos.operator_id));
            const boothRoot = map.get(Number(targetBooth.operator_id));
            if (posRoot != null && boothRoot != null && posRoot !== boothRoot) {
                return res.status(400).json({
                    error:
                        "Device and target booth belong to different operators. " +
                        "You can only request a booth change within your operator family (main + sub-operators).",
                });
            }
        }

        // Enforce same-area rule when the device has an area
        if (pos.area) {
            const deviceArea = String(pos.area).trim().toUpperCase();
            // Derive area from the booth code prefix if possible
            const boothCode = String(targetBooth.booth_code || "").trim().toUpperCase();
            const boothArea = boothCode.startsWith("MOE-") || boothCode.startsWith("MOW-")
                ? "MISOR"
                : boothCode.startsWith("CDO-") || boothCode.startsWith("CD0-")
                    ? "CDO"
                    : null;
            if (boothArea && boothArea !== deviceArea) {
                return res.status(400).json({
                    error:
                        `Area mismatch: the device is in area "${deviceArea}" but the target booth "${targetBooth.booth_code}" appears to be in area "${boothArea}". ` +
                        "You can only request a booth change to a booth within the same area.",
                });
            }
        }

        // Store created_at and updated_at in Asia/Manila local time so the
        // "Submitted" timestamp shown in the Booth Change Requests table matches
        // the time the operator actually submitted the request. The DB column is
        // TIMESTAMP (no timezone), so the value is stored verbatim; pg then reads
        // it back as UTC, and the frontend (which already runs in Asia/Manila)
        // displays the same wall-clock value.
        const nowManila = manilaTimestamp();

        const result = await pool.query(
            `
            INSERT INTO booth_change_requests
                (pos_record_id, requested_booth_id, requested_by_user_id, reason, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id
            `,
            [
                Number(pos_record_id),
                Number(requested_booth_id),
                requested_by_user_id ? Number(requested_by_user_id) : null,
                nullable(reason),
                nowManila,
            ]
        );

        const created = await pool.query(
            `${SELECT_COLUMNS} WHERE bcr.id = $1`,
            [result.rows[0].id]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error("POST booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to create request" });
    }
});

/**
 * POST /api/booth-change-requests/:id/approve
 * Body: { admin_user_id, admin_notes? }
 * Marks the request approved AND swaps the POS device's booth in one transaction.
 * Mirrors the logic in PATCH /api/pos/:id/booth-id including operator validation
 * and writing a row to booth_change_logs.
 */
router.post("/:id/approve", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Lock the request row for update; bail out if not pending
        const reqResult = await client.query(
            `SELECT id, pos_record_id, requested_booth_id, status
             FROM booth_change_requests WHERE id = $1::int FOR UPDATE`,
            [id]
        );
        if (reqResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Request not found" });
        }
        const reqRow = reqResult.rows[0];
        if (reqRow.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: `Request is already ${reqRow.status}`,
            });
        }

        // Load current POS record + new booth
        const posResult = await client.query(
            `SELECT id, device_no, booth_id, operator_id
             FROM pos_records WHERE id = $1::int FOR UPDATE`,
            [reqRow.pos_record_id]
        );
        if (posResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "POS device no longer exists" });
        }
        const pos = posResult.rows[0];

        const boothResult = await client.query(
            `SELECT id, booth_code, operator_id FROM booth_info WHERE id = $1::int`,
            [reqRow.requested_booth_id]
        );
        if (boothResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Requested booth no longer exists" });
        }
        const newBooth = boothResult.rows[0];

        // Validate operator boundary using the same family rule as the
        // create endpoint: a sub-operator can ride within its main, and a
        // main can manage across its subs. Strict equality used to be
        // enforced here and broke admin approvals as soon as the device's
        // operator was a sub of the booth's operator (or vice-versa).
        if (pos.operator_id && newBooth.operator_id) {
            const familyResult = await client.query(
                `SELECT id, COALESCE(parent_operator_id, id) AS root_id
                 FROM operator_list
                 WHERE id = $1::int OR id = $2::int`,
                [pos.operator_id, newBooth.operator_id]
            );
            const map = new Map(
                familyResult.rows.map((row) => [Number(row.id), Number(row.root_id)])
            );
            const posRoot = map.get(Number(pos.operator_id));
            const boothRoot = map.get(Number(newBooth.operator_id));
            if (posRoot != null && boothRoot != null && posRoot !== boothRoot) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: "Cannot approve: requested booth belongs to a different operator",
                });
            }
        }

        const operatorToSet = newBooth.operator_id || pos.operator_id;

        // If a different POS device is currently sitting on the target booth,
        // we mark it Inactive (no delete) so the booth has a clean swap and
        // the displaced device's history is preserved for audit.
        const displaced = await client.query(
            `SELECT id, device_no FROM pos_records
             WHERE booth_id = $1::int AND id <> $2::int`,
            [newBooth.id, pos.id]
        );
        for (const row of displaced.rows) {
            await client.query(
                `UPDATE pos_records
                 SET status = 'Inactive', booth_id = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1::int`,
                [row.id]
            );
            // Also write to booth_change_logs so the inactivation is auditable.
            await client.query(
                `INSERT INTO booth_change_logs
                    (pos_record_id, old_booth_code, new_booth_code, changed_by, created_at)
                 VALUES ($1, $2, NULL, $3, CURRENT_TIMESTAMP)`,
                [
                    row.id,
                    newBooth.booth_code,
                    admin_user_id ? `user:${admin_user_id} (auto-displaced)` : "system (auto-displaced)",
                ]
            );
        }

        // Capture old booth_code for the log row
        const oldBoothCodeResult = pos.booth_id
            ? await client.query(
                `SELECT booth_code FROM booth_info WHERE id = $1::int`,
                [pos.booth_id]
            )
            : null;
        const oldBoothCode = oldBoothCodeResult?.rows?.[0]?.booth_code ?? null;

        // Perform the swap on the POS record
        await client.query(
            `UPDATE pos_records
             SET booth_id = $1::int,
                 operator_id = $2::int,
                 status = 'Active',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3::int`,
            [newBooth.id, operatorToSet, pos.id]
        );

        // Audit log (mirrors the manual-change route)
        await client.query(
            `INSERT INTO booth_change_logs
                (pos_record_id, old_booth_code, new_booth_code, changed_by, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [
                pos.id,
                oldBoothCode,
                newBooth.booth_code,
                admin_user_id ? `user:${admin_user_id}` : "system",
            ]
        );

        // Mark request approved
        await client.query(
            `UPDATE booth_change_requests
             SET status = 'approved',
                 admin_user_id = $1,
                 admin_notes = $2,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3::int`,
            [
                admin_user_id ? Number(admin_user_id) : null,
                nullable(admin_notes),
                id,
            ]
        );

        await client.query("COMMIT");

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE bcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("approve booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to approve request" });
    } finally {
        client.release();
    }
});

/**
 * POST /api/booth-change-requests/:id/reject
 * Body: { admin_user_id, admin_notes? }
 */
router.post("/:id/reject", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE booth_change_requests
             SET status = 'rejected',
                 admin_user_id = $1,
                 admin_notes = $2,
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3::int AND status = 'pending'
             RETURNING id`,
            [
                admin_user_id ? Number(admin_user_id) : null,
                nullable(admin_notes),
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: "Request not found or already decided",
            });
        }

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE bcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("reject booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

/**
 * POST /api/booth-change-requests/:id/cancel
 * Operators withdraw their own pending request.
 */
router.post("/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE booth_change_requests
             SET status = 'cancelled',
                 decided_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1::int
               AND status = 'pending'
               AND ($2::int IS NULL OR requested_by_user_id = $2::int)
             RETURNING id`,
            [id, user_id ? Number(user_id) : null]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                error: "Request not found, already decided, or not yours to cancel",
            });
        }

        const updated = await pool.query(
            `${SELECT_COLUMNS} WHERE bcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("cancel booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

export default router;
