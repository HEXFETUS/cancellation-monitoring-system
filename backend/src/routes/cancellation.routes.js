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
            return sheet.rows || sheet.data || sheet.transactions || [];
        });
    }

    if (payload && typeof payload === "object") {
        return Object.entries(payload).flatMap(([sheetName, rows]) => {
            if (!isAllowedSheetName(sheetName) || !Array.isArray(rows)) return [];
            return rows;
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
        perSheetRows.push(...extractRows(sheetPayload));
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
                    boothCode: String(getField(row, SHEET_COLUMNS.boothCode)).trim(),
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
