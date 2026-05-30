import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const REPAIR_SELECT = `
    SELECT
        rr.*,
        pr.serial_number,
        pr.device_no,
        pr.area,
        ol.operator AS operator_name,
        dl.name AS diagnosis_name,
        pd.repaired_by,
        pd.remarks,
        bt.billing_code,
        bt.received_by
    FROM repair_records rr
    LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
    LEFT JOIN operator_list ol ON rr.operator_id = ol.id
    LEFT JOIN diagnosis_list dl ON rr.diagnosis_id = dl.id
    LEFT JOIN LATERAL (
        SELECT repaired_by, remarks FROM diagnosis_logs
        WHERE repair_record_id = rr.id
        ORDER BY id DESC
        LIMIT 1
    ) pd ON true
    LEFT JOIN LATERAL (
        SELECT billing_code, received_by FROM billing_transmittals
        WHERE repair_record_id = rr.id
        ORDER BY id DESC
        LIMIT 1
    ) bt ON true
`;

async function createDiagnosisLog(
    client,
    {
        repairRecordId,
        requestedBy = null,
        diagnosisName,
        repairedBy,
        status,
        returnedAt = null,
    }
) {
    await client.query(
        `
        INSERT INTO diagnosis_logs (
            repair_record_id,
            requested_at,
            requested_by,
            pos_diagnosis,
            repaired_by,
            remarks,
            status,
            forwarded_at,
            returned_at,
            created_at,
            updated_at
        ) VALUES (
            $1,
            CURRENT_TIMESTAMP,
            $2,
            $3,
            $4,
            NULL,
            $5,
            CURRENT_TIMESTAMP,
            ${returnedAt === "now" ? "CURRENT_TIMESTAMP" : "NULL"},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        `,
        [repairRecordId, requestedBy, diagnosisName, repairedBy, status]
    );
}

async function getNextHexaBillingCode(client) {
    const result = await client.query(`
        SELECT billing_code
        FROM billing_transmittals
        WHERE billing_code ~ '^HEXA-[0-9]{4}$'
        ORDER BY CAST(SUBSTRING(billing_code FROM 6) AS INTEGER) DESC
        LIMIT 1
    `);

    const currentNumber = result.rows[0]?.billing_code
        ? Number(result.rows[0].billing_code.slice(5))
        : 0;

    return `HEXA-${String(currentNumber + 1).padStart(4, "0")}`;
}

/* =========================
   GET ALL REPAIR RECORDS
========================= */
router.get("/", async (_req, res) => {
    try {
        const result = await pool.query(`${REPAIR_SELECT} ORDER BY rr.id DESC`);
        res.json(result.rows);
    } catch (err) {
        console.error("GET repair_records error:", err.message);
        res.status(500).json({ error: "Failed to fetch repair records" });
    }
});

/* =========================
   GET RECORDS BY BILLING CODE
========================= */
router.get("/billing-code/:billingCode", async (req, res) => {
    try {
        const { billingCode } = req.params;
        const code = billingCode?.trim();

        if (!code) {
            return res.status(400).json({ error: "Billing Code is required" });
        }

        const result = await pool.query(
            `
            SELECT
                rr.id,
                rr.operator_id,
                pr.device_no,
                pr.serial_number,
                pr.area,
                ol.operator AS operator_name,
                bt.billing_code
            FROM billing_transmittals bt
            JOIN repair_records rr ON rr.id = bt.repair_record_id
            LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
            LEFT JOIN operator_list ol ON rr.operator_id = ol.id
            WHERE LOWER(TRIM(bt.billing_code)) = LOWER($1)
            ORDER BY rr.id ASC
            `,
            [code]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("GET repair_records/billing-code error:", err.message);
        res.status(500).json({ error: "Failed to fetch billing code records" });
    }
});

/* =========================
   GET EXISTING BILLING CODES
========================= */
router.get("/billing-codes/list", async (req, res) => {
    try {
        const operatorId = req.query.operator_id ? Number(req.query.operator_id) : null;

        if (req.query.operator_id && !Number.isFinite(operatorId)) {
            return res.status(400).json({ error: "Invalid operator" });
        }

        const result = await pool.query(
            `
            SELECT
                bt.billing_code,
                rr.operator_id,
                ol.operator AS operator_name,
                COUNT(DISTINCT rr.id)::int AS pos_count
            FROM billing_transmittals bt
            JOIN repair_records rr ON rr.id = bt.repair_record_id
            LEFT JOIN operator_list ol ON rr.operator_id = ol.id
            WHERE TRIM(bt.billing_code) <> ''
              AND bt.billing_code !~ '^HEXA-[0-9]{4}$'
              AND ($1::int IS NULL OR rr.operator_id = $1::int)
            GROUP BY bt.billing_code, rr.operator_id, ol.operator
            ORDER BY MAX(bt.updated_at) DESC, bt.billing_code ASC
            `,
            [operatorId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("GET repair_records/billing-codes error:", err.message);
        res.status(500).json({ error: "Failed to fetch billing codes" });
    }
});

/* =========================
   GET EXISTING RECEIVERS
========================= */
router.get("/received-by/list", async (_req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                received_by,
                COUNT(*)::int AS usage_count
            FROM billing_transmittals
            WHERE TRIM(COALESCE(received_by, '')) <> ''
            GROUP BY received_by
            ORDER BY MAX(updated_at) DESC, received_by ASC
            `
        );

        res.json(result.rows);
    } catch (err) {
        console.error("GET repair_records/received-by error:", err.message);
        res.status(500).json({ error: "Failed to fetch receivers" });
    }
});

/* =========================
   CHECK POS REPAIR REQUEST ELIGIBILITY
========================= */
router.get("/pos/:posRecordId/request-eligibility", async (req, res) => {
    try {
        const { posRecordId } = req.params;

        const posRecord = await pool.query(
            `SELECT id, status FROM pos_records WHERE id = $1::int LIMIT 1`,
            [posRecordId]
        );

        if (posRecord.rows.length === 0) {
            return res.status(404).json({ eligible: false, error: "POS record not found" });
        }

        if (String(posRecord.rows[0].status || "").trim().toLowerCase() === "not released") {
            return res.json({ eligible: false, error: "The POS is already being repaired" });
        }

        const latestRepairRecord = await pool.query(
            `
            SELECT id, forwarded, released
            FROM repair_records
            WHERE pos_record_id = $1::int
            ORDER BY id DESC
            LIMIT 1
            `,
            [posRecordId]
        );

        if (latestRepairRecord.rows.length > 0) {
            const latest = latestRepairRecord.rows[0];
            if (latest.forwarded !== false || latest.released !== true) {
                return res.json({ eligible: false, error: "The POS is already being repaired" });
            }
        }

        res.json({ eligible: true, error: null });
    } catch (err) {
        console.error("GET repair_records/pos/request-eligibility error:", err.message);
        res.status(500).json({ eligible: false, error: "Failed to check POS repair eligibility" });
    }
});

/* =========================
   GET SINGLE REPAIR RECORD
========================= */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET repair_record error:", err.message);
        res.status(500).json({ error: "Failed to fetch repair record" });
    }
});

/* =========================
   CREATE REPAIR RECORD
========================= */
router.post("/", async (req, res) => {
    try {
        const {
            date,
            pos_record_id,
            ntc,
            operator_id,
            operator_name,
            diagnosis_id,
            delivered_by,
            with_charger,
            with_box,
            status,
        } = req.body;

        if (!date) {
            return res.status(400).json({ error: "Date is required" });
        }
        if (!pos_record_id) {
            return res.status(400).json({ error: "POS record is required" });
        }

        const posRecord = await pool.query(
            `SELECT id, status FROM pos_records WHERE id = $1::int LIMIT 1`,
            [pos_record_id]
        );

        if (posRecord.rows.length === 0) {
            return res.status(404).json({ error: "POS record not found" });
        }

        if (String(posRecord.rows[0].status || "").trim().toLowerCase() === "not released") {
            return res.status(400).json({ error: "The POS is already being repaired" });
        }

        const latestRepairRecord = await pool.query(
            `
            SELECT id, forwarded, released
            FROM repair_records
            WHERE pos_record_id = $1::int
            ORDER BY id DESC
            LIMIT 1
            `,
            [pos_record_id]
        );

        if (latestRepairRecord.rows.length > 0) {
            const latest = latestRepairRecord.rows[0];
            if (latest.forwarded !== false || latest.released !== true) {
                return res.status(400).json({ error: "The POS is already being repaired" });
            }
        }

        const createStatuses = new Set(["For Request", "For Repair"]);
        const initialStatus = createStatuses.has(status) ? status : "For Repair";

        // Resolve operator_id from operator_name if not provided directly
        let resolvedOperatorId = operator_id || null;
        if (!resolvedOperatorId && operator_name?.trim()) {
            const opResult = await pool.query(
                `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
                [operator_name.trim()]
            );
            if (opResult.rows.length > 0) {
                resolvedOperatorId = opResult.rows[0].id;
            }
        }

        // Reuse a cleared/unforwarded repair row for this POS instead of creating a duplicate.
        const existingRecord = await pool.query(
            `SELECT id, released FROM repair_records 
             WHERE pos_record_id = $1 AND status IS NULL 
             AND forwarded = false AND re_repair = false
             ORDER BY id DESC
             LIMIT 1`,
            [pos_record_id]
        );

        let result;
        if (existingRecord.rows.length > 0) {
            // Update existing record
            const existingId = existingRecord.rows[0].id;
            result = await pool.query(
                `
                UPDATE repair_records SET
                    date = $1,
                    ntc = $2,
                    operator_id = $3,
                    diagnosis_id = $4,
                    delivered_by = $5,
                    with_charger = $6,
                    with_box = $7,
                    status = $8,
                    re_repair = CASE WHEN released = true THEN true ELSE re_repair END,
                    released = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $9
                RETURNING *
                `,
                [
                    date,
                    ntc ?? false,
                    resolvedOperatorId,
                    diagnosis_id || null,
                    delivered_by || null,
                    with_charger ?? false,
                    with_box ?? false,
                    initialStatus,
                    existingId,
                ]
            );
        } else {
            // Create new record
            result = await pool.query(
                `
                INSERT INTO repair_records (
                    date, pos_record_id, ntc, operator_id, diagnosis_id,
                    delivered_by, with_charger, with_box, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
                `,
                [
                    date,
                    pos_record_id,
                    ntc ?? false,
                    resolvedOperatorId,
                    diagnosis_id || null,
                    delivered_by || null,
                    with_charger ?? false,
                    with_box ?? false,
                    initialStatus,
                ]
            );
        }

        // Fetch the full record with joins
        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        const responseData = full.rows[0];
        responseData.isUpdate = existingRecord.rows.length > 0;
        res.status(201).json(responseData);
    } catch (err) {
        console.error("POST repair_record error:", err.message);
        res.status(500).json({ error: "Failed to create repair record" });
    }
});

/* =========================
   UPDATE REPAIR RECORD
========================= */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            pos_record_id,
            ntc,
            operator_id,
            operator_name,
            diagnosis_id,
            delivered_by,
            with_charger,
            with_box,
            status,
            forwarded,
            released,
            re_repair,
            repaired_by,
        } = req.body;

        // Resolve operator_id from operator_name if not provided directly
        let resolvedOperatorId = operator_id || null;
        if (!resolvedOperatorId && operator_name?.trim()) {
            const opResult = await pool.query(
                `SELECT id FROM operator_list WHERE LOWER(TRIM(operator)) = LOWER($1) LIMIT 1`,
                [operator_name.trim()]
            );
            if (opResult.rows.length > 0) {
                resolvedOperatorId = opResult.rows[0].id;
            }
        }

        const result = await pool.query(
            `
            UPDATE repair_records SET
                date = COALESCE($1, date),
                pos_record_id = COALESCE($2, pos_record_id),
                ntc = COALESCE($3, ntc),
                operator_id = COALESCE($4, operator_id),
                diagnosis_id = COALESCE($5, diagnosis_id),
                delivered_by = COALESCE($6, delivered_by),
                with_charger = COALESCE($7, with_charger),
                with_box = COALESCE($8, with_box),
                status = COALESCE($9, status),
                forwarded = COALESCE($10, forwarded),
                released = COALESCE($11, released),
                re_repair = COALESCE($12, re_repair),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13::int
            RETURNING *
            `,
            [
                date || null,
                pos_record_id || null,
                ntc ?? null,
                resolvedOperatorId,
                diagnosis_id || null,
                delivered_by ?? null,
                with_charger ?? null,
                with_box ?? null,
                status || null,
                forwarded ?? null,
                released ?? null,
                re_repair ?? null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }

        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        res.json(full.rows[0]);
    } catch (err) {
        console.error("PUT repair_record error:", err.message);
        res.status(500).json({ error: "Failed to update repair record" });
    }
});

/* =========================
   MOVE TO FOR RELEASED + CREATE DIAGNOSIS LOG
========================= */
router.patch("/:id/for-released", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { diagnosis_id, requested_by } = req.body;

        if (!diagnosis_id) {
            return res.status(400).json({ error: "Diagnosis is required" });
        }

        await client.query("BEGIN");

        const repairResult = await client.query(
            `SELECT id, pos_record_id FROM repair_records WHERE id = $1::int FOR UPDATE`,
            [id]
        );

        if (repairResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Repair record not found" });
        }

        const diagnosisResult = await client.query(
            `SELECT id, name FROM diagnosis_list WHERE id = $1::int`,
            [diagnosis_id]
        );

        if (diagnosisResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Diagnosis not found" });
        }

        const repairRecord = repairResult.rows[0];
        const diagnosis = diagnosisResult.rows[0];

        await client.query(
            `
            UPDATE repair_records SET
                diagnosis_id = $1,
                status = 'For Release',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2::int
            `,
            [diagnosis.id, id]
        );

        if (repairRecord.pos_record_id) {
            await client.query(
                `
                UPDATE pos_records SET
                    status = 'Inactive',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::int
                `,
                [repairRecord.pos_record_id]
            );
        }

        await createDiagnosisLog(client, {
            repairRecordId: id,
            requestedBy: requested_by || null,
            diagnosisName: diagnosis.name,
            repairedBy: "Hexa IT",
            status: "Inactive",
            returnedAt: "now",
        });

        const full = await client.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        await client.query("COMMIT");
        res.json(full.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH repair_record/for-released error:", err.message);
        res.status(500).json({ error: "Failed to move repair record to For Release" });
    } finally {
        client.release();
    }
});

/* =========================
   MOVE TO UNDERGOING REPAIR + SAVE TECHNICIAN
========================= */
router.patch("/:id/undergoing-repair", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { repaired_by, requested_by } = req.body;

        if (!repaired_by?.trim()) {
            return res.status(400).json({ error: "Technician is required" });
        }

        await client.query("BEGIN");

        const repairResult = await client.query(
            `
            SELECT rr.id, rr.pos_record_id, dl.name AS diagnosis_name, pr.status AS pos_status
            FROM repair_records rr
            LEFT JOIN diagnosis_list dl ON rr.diagnosis_id = dl.id
            LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
            WHERE rr.id = $1::int
            FOR UPDATE OF rr
            `,
            [id]
        );

        if (repairResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Repair record not found" });
        }

        const repairRecord = repairResult.rows[0];

        await client.query(
            `
            UPDATE repair_records SET
                status = 'Undergoing Repair',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::int
            `,
            [id]
        );

        await createDiagnosisLog(client, {
            repairRecordId: id,
            requestedBy: requested_by || repaired_by.trim(),
            diagnosisName: repairRecord.diagnosis_name || null,
            repairedBy: repaired_by.trim(),
            status: "Under Repair",
        });

        const full = await client.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        await client.query("COMMIT");
        res.json(full.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH repair_record/undergoing-repair error:", err.message);
        res.status(500).json({ error: "Failed to move repair record to Undergoing Repair" });
    } finally {
        client.release();
    }
});

/* =========================
   RECEIVE FROM REPAIR + CREATE BILLING TRANSMITTAL
========================= */
router.patch("/:id/received", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { billing_code, remarks, received_by, user_id, unrepairable_retired } = req.body;

        if (!remarks?.trim()) {
            return res.status(400).json({ error: "Remarks are required" });
        }

        await client.query("BEGIN");

        const repairResult = await client.query(
            `
            SELECT id, pos_record_id
            FROM repair_records
            WHERE id = $1::int
            FOR UPDATE
            `,
            [id]
        );

        if (repairResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Repair record not found" });
        }

        const repairRecord = repairResult.rows[0];
        const diagnosisLogResult = await client.query(
            `
            SELECT id
            FROM diagnosis_logs
            WHERE repair_record_id = $1::int
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [id]
        );

        if (diagnosisLogResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Diagnosis log not found" });
        }

        const diagnosisLogId = diagnosisLogResult.rows[0].id;

        await client.query(
            `
            UPDATE diagnosis_logs SET
                status = 'Inactive',
                remarks = $1,
                returned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2::int
            `,
            [remarks.trim(), diagnosisLogId]
        );

        await client.query(
            `
            UPDATE repair_records SET
                status = 'For Release',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::int
            `,
            [id]
        );

        if (unrepairable_retired && repairRecord.pos_record_id) {
            await client.query(
                `
                UPDATE pos_records SET
                    status = 'Retired',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::int
                `,
                [repairRecord.pos_record_id]
            );
        }

        await client.query(
            `
            INSERT INTO billing_transmittals (
                billing_code,
                diagnosis_log_id,
                received_by,
                user_id,
                repair_record_id,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            `,
            [billing_code?.trim() || "", diagnosisLogId, received_by || null, user_id || null, id]
        );

        const full = await client.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        await client.query("COMMIT");
        res.json(full.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH repair_record/received error:", err.message);
        res.status(500).json({ error: "Failed to receive repair record" });
    } finally {
        client.release();
    }
});

/* =========================
   RELEASE REPAIR RECORD + CREATE RELEASED LOG
========================= */
router.patch("/:id/release", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { billing_code, received_by, user_id } = req.body;
        const providedBillingCode = billing_code?.trim() || "";

        if (!received_by?.trim()) {
            return res.status(400).json({ error: "Received By is required" });
        }

        await client.query("BEGIN");

        const repairResult = await client.query(
            `
            SELECT rr.id, rr.operator_id, pd.repaired_by
            FROM repair_records rr
            LEFT JOIN LATERAL (
                SELECT repaired_by
                FROM diagnosis_logs
                WHERE repair_record_id = rr.id
                ORDER BY id DESC
                LIMIT 1
            ) pd ON true
            WHERE rr.id = $1::int
            FOR UPDATE OF rr
            `,
            [id]
        );

        if (repairResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Repair record not found" });
        }

        const repairRecord = repairResult.rows[0];
        const repairedBy = repairRecord.repaired_by?.trim().toLowerCase() || "";
        const isHexaItRepair = repairedBy === "hexa it";

        if (!isHexaItRepair && !providedBillingCode) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Billing Code is required" });
        }

        const billingResult = await client.query(
            `
            SELECT id, billing_code
            FROM billing_transmittals
            WHERE repair_record_id = $1::int
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [id]
        );

        let billingTransmittalId = billingResult.rows[0]?.id;
        const billingCodeForRelease = providedBillingCode || billingResult.rows[0]?.billing_code || (isHexaItRepair ? await getNextHexaBillingCode(client) : "");

        if (!billingCodeForRelease) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Billing Code is required" });
        }

        const billingOperatorConflict = await client.query(
            `
            SELECT rr.id, ol.operator AS operator_name
            FROM billing_transmittals bt
            JOIN repair_records rr ON rr.id = bt.repair_record_id
            LEFT JOIN operator_list ol ON rr.operator_id = ol.id
            WHERE LOWER(TRIM(bt.billing_code)) = LOWER($1)
              AND rr.id <> $2::int
              AND rr.operator_id IS DISTINCT FROM $3::int
            LIMIT 1
            `,
            [billingCodeForRelease, id, repairRecord.operator_id]
        );

        if (billingOperatorConflict.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: `Billing Code already belongs to another operator (${billingOperatorConflict.rows[0].operator_name || "Unknown"}).`,
            });
        }

        if (billingTransmittalId) {
            await client.query(
                `
                UPDATE billing_transmittals SET
                    billing_code = $1,
                    received_by = $2,
                    user_id = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4::int
                `,
                [billingCodeForRelease, received_by.trim(), user_id || null, billingTransmittalId]
            );
        } else {
            const diagnosisLogResult = await client.query(
                `
                SELECT id
                FROM diagnosis_logs
                WHERE repair_record_id = $1::int
                ORDER BY id DESC
                LIMIT 1
                `,
                [id]
            );

            if (diagnosisLogResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Diagnosis log not found" });
            }

            const insertedBilling = await client.query(
                `
                INSERT INTO billing_transmittals (
                    billing_code,
                    diagnosis_log_id,
                    received_by,
                    user_id,
                    repair_record_id,
                    created_at,
                    updated_at
                ) VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING id
                `,
                [billingCodeForRelease, diagnosisLogResult.rows[0].id, received_by.trim(), user_id || null, id]
            );
            billingTransmittalId = insertedBilling.rows[0].id;
        }

        await client.query(
            `
            UPDATE repair_records SET
                status = 'Released',
                forwarded = false,
                released = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::int
            `,
            [id]
        );

        await client.query(
            `
            INSERT INTO released_logs (
                billing_transmittal_id,
                repair_record_id,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            `,
            [billingTransmittalId, id]
        );

        const full = await client.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [id]);
        await client.query("COMMIT");
        res.json(full.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH repair_record/release error:", err.message);
        res.status(500).json({ error: "Failed to release repair record" });
    } finally {
        client.release();
    }
});

/* =========================
   CLEAR REPAIR RECORD (sets delivered_by and status to NULL)
========================= */
router.patch("/:id/clear", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `
            UPDATE repair_records SET
                delivered_by = NULL,
                status = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::int
            RETURNING *
            `,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }

        // Fetch the full record with joins
        const full = await pool.query(`${REPAIR_SELECT} WHERE rr.id = $1::int`, [result.rows[0].id]);
        res.json(full.rows[0]);
    } catch (err) {
        console.error("PATCH repair_record/clear error:", err.message);
        res.status(500).json({ error: "Failed to clear repair record" });
    }
});

/* =========================
   DELETE REPAIR RECORD
========================= */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM repair_records WHERE id = $1::int RETURNING id`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Repair record not found" });
        }
        res.json({ message: "Repair record deleted successfully" });
    } catch (err) {
        console.error("DELETE repair_record error:", err.message);
        res.status(500).json({ error: "Failed to delete repair record" });
    }
});

export default router;
