import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const GOOGLE_SHEET_DEPLOYMENT_ID =
    process.env.CANCELLATION_SHEET_DEPLOYMENT_ID ||
    "AKfycbxt3n1C0srFJXxBZ0rpHWdMw_Ps8lih3HkU3DExmy-EageSW4-Ic-gBZN_zXXI979agmQ";

const GOOGLE_SHEET_URL =
    process.env.CANCELLATION_SHEET_URL ||
    `https://script.google.com/macros/s/${GOOGLE_SHEET_DEPLOYMENT_ID}/exec`;

const ALLOWED_SHEET_NAMES = new Set(["CDO", "MISOR"]);

const SHEET_COLUMNS = {
    date: ["DATE", "date", "transaction date", "created at", "timestamp"],
    ticketNumber: ["TICKET NUMBER", "ticket_number", "ticket number", "ticket no", "ticket", "ticket id"],
    boothCode: ["BOOTH CODE", "booth_code", "booth code", "booth id", "booth", "outlet"],
    status: ["STATUS", "status", "approval status", "transaction status", "approved/denied"],
    area: ["AREA", "area", "branch", "location"],
    reasonForDeniedTicket: [
        "REASON FOR DENIED TICKET",
        "reason_denied_ticket",
        "reason_for_denied_ticket",
        "reason for denied ticket",
        "reason for deny",
        "reason for denial",
        "deny reason",
    ],
};

function isAllowedSheetName(value) {
    return ALLOWED_SHEET_NAMES.has(String(value || "").trim().toUpperCase());
}

function normalizeKey(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function getField(row, names) {
    const normalized = new Map(
        Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
    );

    for (const name of names) {
        const value = normalized.get(normalizeKey(name));
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }

    return "";
}

function formatDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function parseSheetDate(value) {
    if (!value) return "";

    if (typeof value === "number") {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
        return formatDate(excelEpoch);
    }

    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);

    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return "";

    const [, month, day, year] = match;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.transactions)) return payload.transactions;

    if (Array.isArray(payload?.sheets)) {
        return payload.sheets.flatMap((sheet) => {
            const sheetName = sheet.name || sheet.sheetName || sheet.title;
            if (!isAllowedSheetName(sheetName)) return [];
            const rows = sheet.rows || sheet.data || sheet.transactions || [];
            return rows.map((row) => ({
                ...row,
                AREA: getField(row, SHEET_COLUMNS.area) || sheetName,
            }));
        });
    }

    if (payload && typeof payload === "object") {
        return Object.entries(payload).flatMap(([sheetName, rows]) => {
            if (!isAllowedSheetName(sheetName) || !Array.isArray(rows)) return [];
            return rows.map((row) => ({
                ...row,
                AREA: getField(row, SHEET_COLUMNS.area) || sheetName,
            }));
        });
    }

    return [];
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Sheet request failed with HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            `Google Sheet endpoint did not return JSON rows. It returned: "${text.slice(0, 80)}"`
        );
    }
}

async function fetchSheetRows() {
    const url = new URL(GOOGLE_SHEET_URL);
    url.searchParams.set("sheets", Array.from(ALLOWED_SHEET_NAMES).join(","));

    const payload = await fetchJson(url);
    const rows = extractRows(payload);

    if (rows.length > 0) {
        return rows;
    }

    const perSheetRows = [];
    for (const sheetName of ALLOWED_SHEET_NAMES) {
        const sheetUrl = new URL(GOOGLE_SHEET_URL);
        sheetUrl.searchParams.set("sheet", sheetName);
        const sheetPayload = await fetchJson(sheetUrl);
        perSheetRows.push(
            ...extractRows(sheetPayload).map((row) => ({
                ...row,
                AREA: getField(row, SHEET_COLUMNS.area) || sheetName,
            }))
        );
    }

    return perSheetRows;
}

async function findBoothId(client, boothCode) {
    if (!boothCode) return null;

    const result = await client.query(
        "SELECT id FROM booth_info WHERE LOWER(booth_code) = LOWER($1) LIMIT 1",
        [boothCode]
    );

    return result.rows[0]?.id || null;
}

router.get("/records", async (req, res) => {
    try {
        const { date = formatDate() } = req.query;
        const result = await pool.query(
            `
            SELECT id, date, area, approved, denied, cancelled_by_id, created_at, updated_at
            FROM cancellation_record
            WHERE date = $1::date
            ORDER BY area ASC
            `,
            [date]
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/human-force", async (req, res) => {
    try {
        const { date = formatDate() } = req.query;
        const result = await pool.query(
            `
            SELECT chf.id, chf.date, chf.area, chf.reaseon_for_deny, chf.created_at,
                   chf.booth_id, b.booth_code, chf.ticket_number
            FROM cancellation_human_force chf
            LEFT JOIN booth_info b ON b.id = chf.booth_id
            WHERE chf.date = $1
            ORDER BY chf.created_at DESC, chf.id DESC
            `,
            [date]
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/human-error-booths", async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);

        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ error: "Invalid year or month parameters" });
        }

        const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const result = await pool.query(
            `
            SELECT MIN(chf.id)::int AS id,
                   chf.area,
                   COALESCE(b.booth_code, 'Unassigned') AS booth_code,
                   COUNT(*)::int AS human_error
            FROM cancellation_human_force chf
            LEFT JOIN booth_info b ON b.id = chf.booth_id
            WHERE chf.date >= $1::date
              AND chf.date < ($1::date + INTERVAL '1 month')::date
              AND UPPER(chf.reaseon_for_deny) LIKE '%HUMAN ERROR%'
            GROUP BY chf.area, COALESCE(b.booth_code, 'Unassigned')
            ORDER BY COUNT(*) DESC, COALESCE(b.booth_code, 'Unassigned') ASC
            `,
            [monthStart]
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────── Monthly report ─────────────── */
router.get("/monthly-summary", async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);

        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ error: "Invalid year or month parameters" });
        }

        const monthStr = `${year}-${String(month).padStart(2, "0")}`;

        // Get daily aggregated records
        const recordsResult = await pool.query(
            `
            SELECT date,
                   COALESCE(SUM(approved), 0)::int AS approved,
                   COALESCE(SUM(denied), 0)::int AS denied
            FROM cancellation_record
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')::date
            GROUP BY date
            ORDER BY date
            `,
            [`${monthStr}-01`]
        );

        const areaRecordsResult = await pool.query(
            `
            SELECT date,
                   area,
                   COALESCE(SUM(approved), 0)::int AS approved,
                   COALESCE(SUM(denied), 0)::int AS denied
            FROM cancellation_record
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')::date
            GROUP BY date, area
            ORDER BY date, area
            `,
            [`${monthStr}-01`]
        );

        // Get daily force cancel / human error counts
        const humanForceResult = await pool.query(
            `
            SELECT date,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%FORCE CANCEL%')::int AS force_cancel,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%HUMAN ERROR%')::int AS human_error
            FROM cancellation_human_force
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')::date
            GROUP BY date
            ORDER BY date
            `,
            [`${monthStr}-01`]
        );

        const areaHumanForceResult = await pool.query(
            `
            SELECT date,
                   area,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%FORCE CANCEL%')::int AS force_cancel,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%HUMAN ERROR%')::int AS human_error
            FROM cancellation_human_force
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')::date
            GROUP BY date, area
            ORDER BY date, area
            `,
            [`${monthStr}-01`]
        );

        // Merge into a map by day
        const dayMap = new Map();
        for (const row of recordsResult.rows) {
            const day = new Date(row.date).getUTCDate();
            dayMap.set(day, {
                day,
                approved: row.approved,
                denied: row.denied,
                force_cancel: 0,
                human_error: 0,
            });
        }
        for (const row of humanForceResult.rows) {
            const day = new Date(row.date).getUTCDate();
            if (dayMap.has(day)) {
                const entry = dayMap.get(day);
                entry.force_cancel = row.force_cancel;
                entry.human_error = row.human_error;
            } else {
                dayMap.set(day, {
                    day,
                    approved: 0,
                    denied: 0,
                    force_cancel: row.force_cancel,
                    human_error: row.human_error,
                });
            }
        }

        const areaMap = new Map();
        function getAreaEntry(day, area) {
            const key = `${day}::${area || "Unassigned"}`;
            if (!areaMap.has(key)) {
                areaMap.set(key, {
                    day,
                    area: area || "Unassigned",
                    approved: 0,
                    denied: 0,
                    force_cancel: 0,
                    human_error: 0,
                });
            }
            return areaMap.get(key);
        }

        for (const row of areaRecordsResult.rows) {
            const day = new Date(row.date).getUTCDate();
            const entry = getAreaEntry(day, row.area);
            entry.approved = row.approved;
            entry.denied = row.denied;
        }

        for (const row of areaHumanForceResult.rows) {
            const day = new Date(row.date).getUTCDate();
            const entry = getAreaEntry(day, row.area);
            entry.force_cancel = row.force_cancel;
            entry.human_error = row.human_error;
        }

        const daysInMonth = new Date(year, month, 0).getDate();
        const dailyData = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const areas = Array.from(areaMap.values())
                .filter((area) => area.day === d)
                .map(({ day, ...area }) => area);

            dailyData.push({
                ...(dayMap.get(d) || { day: d, approved: 0, denied: 0, force_cancel: 0, human_error: 0 }),
                areas,
            });
        }

        res.json({
            year,
            month,
            days_in_month: daysInMonth,
            daily: dailyData,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/sync", async (req, res) => {
    const targetDate = req.body?.date || formatDate();
    const syncAll = req.body?.sync_all === true;
    const cancelledById = req.body?.cancelled_by_id || null;
    const client = await pool.connect();

    try {
        const rows = await fetchSheetRows();
        const rowsToSync = rows
            .map((row) => ({
                row,
                rowDate: parseSheetDate(getField(row, SHEET_COLUMNS.date)),
            }))
            .filter(({ rowDate }) => {
                if (!rowDate) return false;
                return syncAll || rowDate === targetDate;
            });

        const affectedDates = new Set(rowsToSync.map(({ rowDate }) => rowDate));
        const summaryByDateArea = new Map();
        const humanForceRows = [];

        for (const { row, rowDate } of rowsToSync) {
            const area = String(getField(row, SHEET_COLUMNS.area) || "Unassigned").trim();
            const status = String(getField(row, SHEET_COLUMNS.status)).trim().toUpperCase();
            const reason = String(getField(row, SHEET_COLUMNS.reasonForDeniedTicket)).trim();
            const boothCode = String(getField(row, SHEET_COLUMNS.boothCode)).trim();
            const summaryKey = `${rowDate}::${area}`;

            if (!summaryByDateArea.has(summaryKey)) {
                summaryByDateArea.set(summaryKey, { date: rowDate, area, approved: 0, denied: 0 });
            }

            const summary = summaryByDateArea.get(summaryKey);
            if (status.includes("APPROVED")) summary.approved += 1;
            if (status.includes("DENIED")) summary.denied += 1;

            const normalizedReason = reason.toUpperCase();
            if (status.includes("DENIED") && (normalizedReason.includes("FORCE CANCEL") || normalizedReason.includes("HUMAN ERROR"))) {
                humanForceRows.push({
                    date: rowDate,
                    area,
                    reason,
                    boothCode,
                    ticketNumber: String(getField(row, SHEET_COLUMNS.ticketNumber)).trim(),
                });
            }
        }

        await client.query("BEGIN");

        for (const date of affectedDates) {
            await client.query("DELETE FROM cancellation_human_force WHERE date = $1", [date]);
            await client.query("DELETE FROM cancellation_record WHERE date = $1::date", [date]);
        }

        const insertedRecords = [];
        for (const summary of summaryByDateArea.values()) {
            const result = await client.query(
                `
                INSERT INTO cancellation_record (date, area, cancelled_by_id, approved, denied)
                VALUES ($1::date, $2, $3::int, $4::int, $5::int)
                RETURNING id, date, area, approved, denied, cancelled_by_id, created_at, updated_at
                `,
                [summary.date, summary.area, cancelledById, summary.approved, summary.denied]
            );
            insertedRecords.push(result.rows[0]);
        }

        const insertedHumanForce = [];
        for (const item of humanForceRows) {
            const boothId = await findBoothId(client, item.boothCode);
            const result = await client.query(
                `
                INSERT INTO cancellation_human_force (date, area, reaseon_for_deny, booth_id, ticket_number)
                VALUES ($1, $2, $3, $4::int, $5)
                RETURNING id, date, area, reaseon_for_deny, created_at, booth_id, ticket_number
                `,
                [item.date, item.area, item.reason, boothId, item.ticketNumber]
            );
            insertedHumanForce.push(result.rows[0]);
        }

        await client.query("COMMIT");

        res.json({
            date: targetDate,
            sync_all: syncAll,
            synced_dates: Array.from(affectedDates).sort(),
            fetched: rows.length,
            scanned: rowsToSync.length,
            records: insertedRecords,
            human_force: insertedHumanForce,
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post("/sync-date", async (req, res) => {
    const targetDate = req.body?.date || formatDate();
    const cancelledById = req.body?.cancelled_by_id || null;
    const client = await pool.connect();

    try {
        const rows = await fetchSheetRows();
        const dailyRows = rows.filter((row) => {
            const rowDate = parseSheetDate(getField(row, SHEET_COLUMNS.date));
            return rowDate === targetDate;
        });

        const summaryByArea = new Map();
        const humanForceRows = [];

        for (const row of dailyRows) {
            const area = String(getField(row, SHEET_COLUMNS.area) || "Unassigned").trim();
            const status = String(getField(row, SHEET_COLUMNS.status)).trim().toUpperCase();
            const reason = String(getField(row, SHEET_COLUMNS.reasonForDeniedTicket)).trim();

            if (!summaryByArea.has(area)) {
                summaryByArea.set(area, { area, approved: 0, denied: 0 });
            }

            const summary = summaryByArea.get(area);
            if (status.includes("APPROVED")) summary.approved += 1;
            if (status.includes("DENIED")) summary.denied += 1;

            const normalizedReason = reason.toUpperCase();
            if (status.includes("DENIED") && (normalizedReason.includes("FORCE CANCEL") || normalizedReason.includes("HUMAN ERROR"))) {
                humanForceRows.push({
                    date: targetDate,
                    area,
                    reason,
                    boothCode: String(getField(row, SHEET_COLUMNS.boothCode)).trim(),
                    ticketNumber: String(getField(row, SHEET_COLUMNS.ticketNumber)).trim(),
                });
            }
        }

        await client.query("BEGIN");
        await client.query("DELETE FROM cancellation_human_force WHERE date = $1", [targetDate]);
        await client.query("DELETE FROM cancellation_record WHERE date = $1::date", [targetDate]);

        const insertedRecords = [];
        for (const summary of summaryByArea.values()) {
            const result = await client.query(
                `
                INSERT INTO cancellation_record (date, area, cancelled_by_id, approved, denied)
                VALUES ($1::date, $2, $3::int, $4::int, $5::int)
                RETURNING id, date, area, approved, denied, cancelled_by_id, created_at, updated_at
                `,
                [targetDate, summary.area, cancelledById, summary.approved, summary.denied]
            );
            insertedRecords.push(result.rows[0]);
        }

        const insertedHumanForce = [];
        for (const item of humanForceRows) {
            const boothId = await findBoothId(client, item.boothCode);
            const result = await client.query(
                `
                INSERT INTO cancellation_human_force (date, area, reaseon_for_deny, booth_id, ticket_number)
                VALUES ($1, $2, $3, $4::int, $5)
                RETURNING id, date, area, reaseon_for_deny, created_at, booth_id, ticket_number
                `,
                [item.date, item.area, item.reason, boothId, item.ticketNumber]
            );
            insertedHumanForce.push(result.rows[0]);
        }

        await client.query("COMMIT");

        res.json({
            date: targetDate,
            fetched: rows.length,
            scanned: dailyRows.length,
            records: insertedRecords,
            human_force: insertedHumanForce,
        });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

export default router;
