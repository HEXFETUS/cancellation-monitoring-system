import express from "express";
import pool from "../config/db.js";

const router = express.Router();

async function columnExists(tableName, columnName) {
    const result = await pool.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
        ) AS exists
        `,
        [tableName, columnName]
    );
    return result.rows[0]?.exists === true;
}

router.get("/admin-stats", async (_req, res) => {
    try {
        const [hasOnProcess, hasApproved, hasDenied, hasReleased] = await Promise.all([
            columnExists("cancellation_record", "on_process"),
            columnExists("cancellation_record", "approved"),
            columnExists("cancellation_record", "denied"),
            columnExists("repair_records", "released"),
        ]);

        const cancellationTotalSql = hasApproved && hasDenied
            ? "COALESCE(SUM(COALESCE(approved, 0) + COALESCE(denied, 0)), 0)::int"
            : "COUNT(*)::int";

        const [posCountResult, posStatusResult, operatorsCountResult, boothsCountResult, repairsAggResult, repairStatusResult, releasedCountResult, cancellationTotalResult, cancellationMonthResult, cancellationYearResult, cancellationPendingResult, usersCountResult, usersByTypeResult, recentActivityResult] =
            await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS count FROM pos_records`),
                pool.query(`
                    SELECT
                        COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'active'), 0)::int AS active,
                        COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('offline', 'inactive', 'not released')), 0)::int AS offline,
                        COALESCE(COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) LIKE '%reset%'), 0)::int AS pending_reset
                    FROM pos_records
                `),
                pool.query(`SELECT COUNT(*)::int AS count FROM operator_list`),
                pool.query(`SELECT COUNT(*)::int AS count FROM booth_info`),
                pool.query(`
                    SELECT
                        COUNT(*)::int AS repair_logs,
                        COALESCE(COUNT(*) FILTER (
                            WHERE status IS NOT NULL
                              AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('released', 'completed')
                        ), 0)::int AS active_requests,
                        COALESCE(COUNT(*) FILTER (
                            WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('released', 'completed')
                               ${hasReleased ? "OR released = true" : ""}
                        ), 0)::int AS completed
                    FROM repair_records
                `),
                pool.query(`
                    SELECT
                        COALESCE(COUNT(*) FILTER (
                            WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('pending', 'for request', 'for repair')
                        ), 0)::int AS pending,
                        COALESCE(COUNT(*) FILTER (
                            WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('in_progress', 'ongoing', 'undergoing repair', 'under repair')
                        ), 0)::int AS in_progress,
                        COALESCE(COUNT(*) FILTER (
                            WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('released', 'for release', 'completed')
                               ${hasReleased ? "OR released = true" : ""}
                        ), 0)::int AS completed
                    FROM repair_records
                `),
                pool.query(`SELECT COUNT(*)::int AS count FROM released_logs`),
                pool.query(`SELECT ${cancellationTotalSql} AS total FROM cancellation_record`),
                pool.query(`
                    SELECT COUNT(*)::int AS count
                    FROM cancellation_record
                    WHERE created_at >= date_trunc('month', CURRENT_DATE)
                `),
                pool.query(`
                    SELECT COUNT(*)::int AS count
                    FROM cancellation_record
                    WHERE created_at >= date_trunc('year', CURRENT_DATE)
                `),
                hasOnProcess
                    ? pool.query(`
                        SELECT COUNT(*)::int AS count
                        FROM cancellation_record
                        WHERE on_process = true
                    `)
                    : Promise.resolve({ rows: [{ count: 0 }] }),
                pool.query(`SELECT COUNT(*)::int AS count FROM users`),
                pool.query(`
                    SELECT
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'admin'), 0)::int AS admins,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'csr'), 0)::int AS csrs,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'operator'), 0)::int AS operators,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'purchaser'), 0)::int AS purchasers
                    FROM users
                `),
                pool.query(`
                    SELECT * FROM (
                        SELECT 
                            'Cancellation' AS action,
                            'Uploaded for ' || COALESCE(area, 'Unknown') || ' (Approved: ' || COALESCE(approved::text, '0') || ', Denied: ' || COALESCE(denied::text, '0') || ')' AS summary,
                            'System' AS user_name,
                            created_at
                        FROM cancellation_record

                        UNION ALL

                        SELECT 
                            'POS Repair' AS action,
                            'Request for POS #' || COALESCE(pr.device_no, 'Unknown') || ' (' || COALESCE(dl.name, 'No diagnosis') || ')' AS summary,
                            'System' AS user_name,
                            rr.created_at
                        FROM repair_records rr
                        LEFT JOIN pos_records pr ON rr.pos_record_id = pr.id
                        LEFT JOIN diagnosis_list dl ON rr.diagnosis_id = dl.id

                        UNION ALL

                        SELECT 
                            'Booth Change' AS action,
                            'POS #' || COALESCE(p.device_no, 'Unknown') || ' (' || COALESCE(bcr.old_booth_code, '—') || ' → ' || COALESCE(rb.booth_code, '—') || ') - ' || COALESCE(bcr.status, 'pending') AS summary,
                            COALESCE(u.name, 'Operator') AS user_name,
                            bcr.created_at
                        FROM booth_change_requests bcr
                        LEFT JOIN pos_records p ON bcr.pos_record_id = p.id
                        LEFT JOIN booth_info rb ON bcr.requested_booth_id = rb.id
                        LEFT JOIN users u ON bcr.requested_by_user_id = u.id

                        UNION ALL

                        SELECT 
                            'Operator Change' AS action,
                            'POS #' || COALESCE(p.device_no, 'Unknown') || ' (' || COALESCE(ocr.old_operator, '—') || ' → ' || COALESCE(
                                COALESCE(
                                    (SELECT o.operator FROM operator_list o WHERE o.user_id = ocr.user_id LIMIT 1),
                                    (SELECT o.sub_op_name FROM operator_list o WHERE o.user_id = ocr.user_id LIMIT 1)
                                ),
                                'New Operator'
                            ) || ') - ' || COALESCE(ocr.status, 'pending') AS summary,
                            COALESCE(u.name, 'Operator') AS user_name,
                            ocr.created_at
                        FROM operator_change_requests ocr
                        LEFT JOIN pos_records p ON ocr.pos_record_id = p.id
                        LEFT JOIN users u ON ocr.user_id = u.id
                    ) combined_activity
                    ORDER BY created_at DESC
                    LIMIT 10
                `),
                pool.query(`SELECT COUNT(*)::int AS count FROM users`),
                pool.query(`
                    SELECT
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'admin'), 0)::int AS admins,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'csr'), 0)::int AS csrs,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'operator'), 0)::int AS operators,
                        COALESCE(COUNT(*) FILTER (WHERE usertype = 'purchaser'), 0)::int AS purchasers
                    FROM users
                `),
            ]);

        const posStatus = posStatusResult.rows[0];
        const repairsAgg = repairsAggResult.rows[0];
        const repairStatus = repairStatusResult.rows[0];

        res.json({
            pos: {
                total: posCountResult.rows[0].count,
                active: posStatus.active,
                offline: posStatus.offline,
                pendingReset: posStatus.pending_reset,
                operatorsCount: operatorsCountResult.rows[0].count,
                outletsCount: boothsCountResult.rows[0].count,
            },
            repairs: {
                totalRequests: repairsAgg.active_requests,
                repairLogs: repairsAgg.repair_logs,
                completed: repairStatus.completed,
                released: releasedCountResult.rows[0].count,
                pendingRepairs: repairStatus.pending,
                inProgress: repairStatus.in_progress,
            },
            cancellations: {
                totalRecords: cancellationTotalResult.rows[0].total,
                todayCount: 0,
                thisMonth: cancellationMonthResult.rows[0].count,
                thisYear: cancellationYearResult.rows[0].count,
                pending: cancellationPendingResult.rows[0].count,
            },
            users: {
                total: usersCountResult.rows[0].count,
                ...usersByTypeResult.rows[0],
            },
            recentActivity: recentActivityResult.rows,
            overview: {
                systemStatus: "All Systems Normal",
            },
        });
    } catch (err) {
        console.error("[dashboard] admin-stats error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
});

export default router;
