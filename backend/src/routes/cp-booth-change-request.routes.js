import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const SELECT_COLUMNS = `
    SELECT
        cpbcr.id,
        cpbcr.cellphone_id,
        cpbcr.requested_by_user_id,
        cpbcr.requested_booth_id,
        cpbcr.reason,
        cpbcr.status,
        cpbcr.admin_user_id,
        cpbcr.admin_notes,
        cpbcr.decided_at,
        cpbcr.created_at,
        cpbcr.updated_at,
        cl.brand,
        cl.model,
        cl.control_no,
        cl.serial_number,
        rb.booth_code AS requested_booth_code,
        ru.name AS requested_by_name,
        au.name AS admin_name
    FROM cp_booth_change_requests cpbcr
    LEFT JOIN cellphone_list cl ON cpbcr.cellphone_id = cl.id
    LEFT JOIN booth_info rb ON cpbcr.requested_booth_id = rb.id
    LEFT JOIN users ru ON cpbcr.requested_by_user_id = ru.id
    LEFT JOIN users au ON cpbcr.admin_user_id = au.id
`;

function nullable(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

// Returns the current time in Asia/Manila formatted as a PostgreSQL TIMESTAMP string
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
 * GET /api/cp-booth-change-requests
 * Query params:
 *   status=pending|approved|rejected|cancelled
 *   userId=<id>
 *   cellphone_id=<id>
 */
router.get("/", async (req, res) => {
    try {
        const { status, userId, cellphone_id } = req.query;
        const conditions = [];
        const params = [];

        if (status) {
            params.push(String(status));
            conditions.push(`cpbcr.status = $${params.length}`);
        }
        if (userId) {
            params.push(Number(userId));
            conditions.push(`cpbcr.requested_by_user_id = $${params.length}`);
        }
        if (cellphone_id) {
            params.push(Number(cellphone_id));
            conditions.push(`cpbcr.cellphone_id = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `${SELECT_COLUMNS} ${where} ORDER BY cpbcr.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET cp-booth-change-requests error:", err.message);
        res.status(500).json({ error: "Failed to fetch CP booth change requests" });
    }
});

/**
 * POST /api/cp-booth-change-requests
 * Body: { cellphone_id, requested_booth_id, requested_by_user_id, reason? }
 * Operator submits a request to assign their cellphone to a booth.
 */
router.post("/", async (req, res) => {
    const { cellphone_id, requested_booth_id, requested_by_user_id, reason } = req.body ?? {};

    if (!cellphone_id || !requested_booth_id) {
        return res.status(400).json({
            error: "cellphone_id and requested_booth_id are required",
        });
    }

    try {
        // Reject if there's already a pending request for the same cellphone
        const existing = await pool.query(
            `SELECT id FROM cp_booth_change_requests
             WHERE cellphone_id = $1 AND status = 'pending' LIMIT 1`,
            [cellphone_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "A pending request already exists for this cellphone",
            });
        }

        // Validate the cellphone exists
        const cpResult = await pool.query(
            `SELECT id, brand, model, operator_id, booth_id
             FROM cellphone_list WHERE id = $1::int LIMIT 1`,
            [cellphone_id]
        );
        if (cpResult.rows.length === 0) {
            return res.status(404).json({ error: "Cellphone not found" });
        }
        const cellphone = cpResult.rows[0];

        // Validate the target booth exists
        const boothResult = await pool.query(
            `SELECT id, booth_code, operator_id
             FROM booth_info WHERE id = $1::int LIMIT 1`,
            [requested_booth_id]
        );
        if (boothResult.rows.length === 0) {
            return res.status(404).json({ error: "Target booth not found" });
        }
        const targetBooth = boothResult.rows[0];

        // Enforce same-operator-family rule
        if (cellphone.operator_id && targetBooth.operator_id) {
            const familyResult = await pool.query(
                `SELECT id, COALESCE(parent_operator_id, id) AS root_id
                 FROM operator_list
                 WHERE id = $1::int OR id = $2::int`,
                [cellphone.operator_id, targetBooth.operator_id]
            );
            const map = new Map(
                familyResult.rows.map((row) => [Number(row.id), Number(row.root_id)])
            );
            const cpRoot = map.get(Number(cellphone.operator_id));
            const boothRoot = map.get(Number(targetBooth.operator_id));
            if (cpRoot != null && boothRoot != null && cpRoot !== boothRoot) {
                return res.status(400).json({
                    error:
                        "Cellphone and target booth belong to different operators. " +
                        "You can only request a booth change within your operator family (main + sub-operators).",
                });
            }
        }

        const nowManila = manilaTimestamp();

        const result = await pool.query(
            `
            INSERT INTO cp_booth_change_requests
                (cellphone_id, requested_booth_id, requested_by_user_id, reason, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id
            `,
            [
                Number(cellphone_id),
                Number(requested_booth_id),
                requested_by_user_id ? Number(requested_by_user_id) : null,
                nullable(reason),
                nowManila,
            ]
        );

        const created = await pool.query(
            `${SELECT_COLUMNS} WHERE cpbcr.id = $1`,
            [result.rows[0].id]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error("POST cp-booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to create CP booth change request" });
    }
});

/**
 * POST /api/cp-booth-change-requests/:id/approve
 * Body: { admin_user_id, admin_notes? }
 * Approves the request and updates the cellphone's booth_id + status.
 */
router.post("/:id/approve", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Lock the request row
        const reqResult = await client.query(
            `SELECT id, cellphone_id, requested_booth_id, status
             FROM cp_booth_change_requests WHERE id = $1::int FOR UPDATE`,
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

        // Load the cellphone
        const cpResult = await client.query(
            `SELECT id, brand, model, operator_id FROM cellphone_list WHERE id = $1::int FOR UPDATE`,
            [reqRow.cellphone_id]
        );
        if (cpResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Cellphone no longer exists" });
        }

        // Load the requested booth
        const boothResult = await client.query(
            `SELECT id, booth_code, operator_id FROM booth_info WHERE id = $1::int`,
            [reqRow.requested_booth_id]
        );
        if (boothResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Requested booth no longer exists" });
        }

        // Update the cellphone: assign booth and set status to Active
        await client.query(
            `UPDATE cellphone_list
             SET booth_id = $1::int,
                 status = 'Active',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2::int`,
            [reqRow.requested_booth_id, reqRow.cellphone_id]
        );

        // Mark request approved
        await client.query(
            `UPDATE cp_booth_change_requests
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
            `${SELECT_COLUMNS} WHERE cpbcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("approve cp-booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to approve CP booth change request" });
    } finally {
        client.release();
    }
});

/**
 * POST /api/cp-booth-change-requests/:id/reject
 * Body: { admin_user_id, admin_notes? }
 */
router.post("/:id/reject", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { admin_user_id, admin_notes } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE cp_booth_change_requests
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
            `${SELECT_COLUMNS} WHERE cpbcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("reject cp-booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to reject CP booth change request" });
    }
});

/**
 * POST /api/cp-booth-change-requests/:id/cancel
 * Operators withdraw their own pending request.
 */
router.post("/:id/cancel", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { user_id } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE cp_booth_change_requests
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
            `${SELECT_COLUMNS} WHERE cpbcr.id = $1::int`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        console.error("cancel cp-booth-change-request error:", err.message);
        res.status(500).json({ error: "Failed to cancel CP booth change request" });
    }
});

export default router;