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

/* ─────────────── Verify ticket exists in Google Sheet ─────────────── */
async function findTicketInSheet(ticketNumber) {
    const rows = await fetchSheetRows();

    const upperTicket = ticketNumber.trim().toUpperCase();

    // First try matching by ticket number (column B)
    let match = rows.find((row) => {
        const rowTicket = String(getField(row, SHEET_COLUMNS.ticketNumber)).trim().toUpperCase();
        return rowTicket === upperTicket;
    });

    // If not found by ticket number, try matching by reference code (column C)
    if (!match) {
        match = rows.find((row) => {
            // Reference code may be in a field called "REFCODE" or similar
            const refCode = String(row["REFCODE"] || row["REFERENCE CODE"] || row["reference_code"] || row["refcode"] || "").trim().toUpperCase();
            return refCode === upperTicket;
        });
    }

    if (!match) {
        throw new Error(`Ticket number "${ticketNumber}" not found in the Google Sheet.`);
    }

    // Return the area from the matched row
    return {
        area: String(getField(match, SHEET_COLUMNS.area) || "Unassigned").trim(),
        boothCode: String(getField(match, SHEET_COLUMNS.boothCode)).trim(),
    };
}

/* ─────────────── Insert a single human-force / deny reason record ─────────────── */
router.post("/human-force", async (req, res) => {
    try {
        const { ticket_number, reference_code, booth_code, reaseon_for_deny, area, booth_id } = req.body;

        if (!ticket_number || !reaseon_for_deny) {
            return res.status(400).json({ error: "ticket_number and reaseon_for_deny are required" });
        }

        const normalizedReason = reaseon_for_deny.toUpperCase();
        if (normalizedReason !== "FORCE CANCEL" && normalizedReason !== "HUMAN ERROR") {
            return res.status(400).json({ error: 'reaseon_for_deny must be "FORCE CANCEL" or "HUMAN ERROR"' });
        }

        // 1. Determine area from booth_code prefix if provided, otherwise default
        let resolvedArea = area || "Unassigned";

        // Derive area from booth_code prefix if provided
        if (booth_code) {
            const upperBooth = booth_code.trim().toUpperCase();
            if (upperBooth.startsWith("CDO-")) {
                resolvedArea = "CDO";
            } else if (upperBooth.startsWith("MOE-") || upperBooth.startsWith("MOW-")) {
                resolvedArea = "MISOR";
            }
        }

        // 2. Verify the ticket exists in the Google Sheet
        let ticketInfo = { area: resolvedArea, boothCode: "" };
        try {
            ticketInfo = await findTicketInSheet(ticket_number);
            if (!booth_code) {
                resolvedArea = ticketInfo.area;
            }
        } catch (sheetErr) {
            if (!booth_code) {
                return res.status(400).json({ error: sheetErr.message });
            }
        }

        // 3. Look up booth_id from booth code if available
        let resolvedBoothId = booth_id || null;
        const effectiveBoothCode = booth_code || ticketInfo.boothCode;
        if (effectiveBoothCode && !booth_id) {
            const boothResult = await pool.query(
                "SELECT id FROM booth_info WHERE LOWER(booth_code) = LOWER($1) LIMIT 1",
                [effectiveBoothCode]
            );
            resolvedBoothId = boothResult.rows[0]?.id || null;
        }

        // Format datetime in Manila timezone (Asia/Manila, UTC+8) — returns "M/D/YYYY HH:mm:ss"
        const manilaNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

        // 4. Add a new transaction row to the correct area tab (CDO or MISOR) via GAS
        let sheetError = null;

        // Use the user's name if provided, otherwise fall back to area - SYSTEM
        const cancelledByValue = req.body.cancelled_by
            ? `${req.body.cancelled_by} - SYSTEM`
            : `${resolvedArea} - SYSTEM`;

        try {
            const sheetUrl = new URL(GOOGLE_SHEET_URL);

            const sheetResponse = await fetch(sheetUrl.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: manilaNow,
                    ticket: ticket_number,
                    refcode: reference_code || "",
                    booth: booth_code || ticketInfo.boothCode || "",
                    status: "DENIED ❌",
                    cancelled_by: cancelledByValue,
                    reason_denied_ticket: reaseon_for_deny,
                }),
            });

            const sheetResultText = await sheetResponse.text();
            console.log(`GAS POST response for ticket ${ticket_number} (tab=${resolvedArea}): ${sheetResultText}`);

            if (sheetResultText.includes("Error") || sheetResultText.includes("❌")) {
                sheetError = sheetResultText.replace(/[❌⚠️✅]/g, "").trim();
            }
        } catch (sheetWriteErr) {
            console.error(`Failed to add transaction to sheet for ticket ${ticket_number}: ${sheetWriteErr.message}`);
            sheetError = `Failed to update sheet: ${sheetWriteErr.message}`;
        }

        // 5. Save to database with Manila date (date only for DB)
        const manilaDateOnlyStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

        const result = await pool.query(
            `
            INSERT INTO cancellation_human_force (date, area, reaseon_for_deny, booth_id, ticket_number, reference_code, booth_code)
            VALUES ($1::date, $2, $3, $4::int, $5, $6, $7)
            RETURNING id
            `,
            [manilaDateOnlyStr, resolvedArea, reaseon_for_deny, resolvedBoothId, ticket_number, reference_code || null, booth_code || null]
        );

        res.status(201).json({
            id: result.rows[0].id,
            area: resolvedArea,
            message: `Transaction added to ${resolvedArea} tab. Record saved with reason: ${reaseon_for_deny}.`,
            sheet_warning: sheetError || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────── Update ticket reason in sheet (Ticket Details form) ─────────────── */
router.post("/update-ticket-reason", async (req, res) => {
    try {
        const { ticket_number, reaseon_for_deny } = req.body;

        if (!ticket_number || !reaseon_for_deny) {
            return res.status(400).json({ error: "ticket_number and reaseon_for_deny are required" });
        }

        const normalizedReason = reaseon_for_deny.toUpperCase();
        if (normalizedReason !== "FORCE CANCEL" && normalizedReason !== "HUMAN ERROR") {
            return res.status(400).json({ error: 'reaseon_for_deny must be "FORCE CANCEL" or "HUMAN ERROR"' });
        }

        // 1. Find ticket in Google Sheet to determine the area (CDO or MISOR).
        // Sheet failures used to short-circuit the whole request with a 400,
        // which made the page error every time the GAS endpoint hiccupped.
        // Now we degrade gracefully: if the lookup fails, we still save to
        // the DB with a best-guess area and surface the failure as a warning.
        let ticketInfo;
        let ticketLookupError = null;
        try {
            ticketInfo = await findTicketInSheet(ticket_number);
        } catch (sheetErr) {
            console.error(
                `update-ticket-reason: sheet lookup failed for ${ticket_number}:`,
                sheetErr.message
            );
            ticketLookupError = sheetErr.message || "Unknown sheet lookup error";
            ticketInfo = { area: "Unassigned", boothCode: "" };
        }

        // 2. Update the reason in the Google Sheet using GAS UPDATE_REASON
        //    This only modifies the REASON FOR DENIED TICKET column in the matched row
        //    It does NOT add a new transaction row.
        //    Skip the sheet write entirely if the lookup already failed —
        //    we wouldn't know which tab to target.
        let sheetError = ticketLookupError;
        let sheetSkipped = false;
        if (!ticketLookupError) {
            try {
                const sheetUrl = new URL(GOOGLE_SHEET_URL);
                const sheetResponse = await fetch(sheetUrl.toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "UPDATE_REASON",
                        area: ticketInfo.area,
                        ticket: ticket_number,
                        reason_denied_ticket: reaseon_for_deny,
                    }),
                });

                const sheetResultText = await sheetResponse.text();
                console.log(`GAS UPDATE_REASON response for ticket ${ticket_number} in ${ticketInfo.area}: ${sheetResultText}`);

                if (sheetResultText.includes("Error") || sheetResultText.includes("❌")) {
                    sheetError = sheetResultText.replace(/[❌⚠️✅]/g, "").trim();
                } else if (sheetResultText.includes("⏭️")) {
                    // Skipped because reason already set or status is APPROVED
                    sheetSkipped = true;
                    sheetError = sheetResultText.replace(/[❌⚠️✅⏭️]/g, "").trim();
                }
            } catch (sheetWriteErr) {
                console.error(`Failed to update reason in sheet for ticket ${ticket_number}: ${sheetWriteErr.message}`);
                sheetError = `Failed to update sheet: ${sheetWriteErr.message}`;
            }
        }

        // 3. Format date in Manila timezone
        const manilaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

        // 4. Save to database with Manila date
        const result = await pool.query(
            `
            INSERT INTO cancellation_human_force (date, area, reaseon_for_deny, booth_id, ticket_number)
            VALUES ($1::date, $2, $3, $4::int, $5)
            RETURNING id
            `,
            [manilaDateStr, ticketInfo.area, reaseon_for_deny, null, ticket_number]
        );

        if (sheetSkipped) {
            return res.status(201).json({
                id: result.rows[0].id,
                area: ticketInfo.area,
                message: `Ticket "${ticket_number}" found in ${ticketInfo.area}. Reason recorded in database, but sheet update was skipped.`,
                sheet_warning: sheetError || null,
            });
        }

        if (ticketLookupError) {
            return res.status(201).json({
                id: result.rows[0].id,
                area: ticketInfo.area,
                message: `Reason saved to the database. Sheet lookup did not return a result, so the spreadsheet was not updated.`,
                sheet_warning: ticketLookupError,
            });
        }

        res.status(201).json({
            id: result.rows[0].id,
            area: ticketInfo.area,
            message: `Ticket "${ticket_number}" found in ${ticketInfo.area}. Reason updated successfully.`,
            sheet_warning: sheetError || null,
        });
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
        await client.query("ROLLBACK").catch(() => { });
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
        await client.query("ROLLBACK").catch(() => { });
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/* ─────────────── Yearly report ─────────────── */
router.get("/yearly-summary", async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10);

        if (!year) {
            return res.status(400).json({ error: "Invalid year parameter" });
        }

        // Get monthly aggregated records
        const recordsResult = await pool.query(
            `
            SELECT EXTRACT(MONTH FROM date)::int AS month,
                   COALESCE(SUM(approved), 0)::int AS approved,
                   COALESCE(SUM(denied), 0)::int AS denied
            FROM cancellation_record
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 year')::date
            GROUP BY EXTRACT(MONTH FROM date)
            ORDER BY month
            `,
            [`${year}-01-01`]
        );

        // Get monthly force cancel / human error counts
        const humanForceResult = await pool.query(
            `
            SELECT EXTRACT(MONTH FROM date)::int AS month,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%FORCE CANCEL%')::int AS force_cancel,
                   COUNT(*) FILTER (WHERE UPPER(reaseon_for_deny) LIKE '%HUMAN ERROR%')::int AS human_error
            FROM cancellation_human_force
            WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 year')::date
            GROUP BY EXTRACT(MONTH FROM date)
            ORDER BY month
            `,
            [`${year}-01-01`]
        );

        // Merge into a map by month
        const monthMap = new Map();
        for (let m = 1; m <= 12; m++) {
            monthMap.set(m, {
                month: m,
                approved: 0,
                denied: 0,
                force_cancel: 0,
                human_error: 0,
            });
        }

        for (const row of recordsResult.rows) {
            const entry = monthMap.get(row.month);
            if (entry) {
                entry.approved = row.approved;
                entry.denied = row.denied;
            }
        }

        for (const row of humanForceResult.rows) {
            const entry = monthMap.get(row.month);
            if (entry) {
                entry.force_cancel = row.force_cancel;
                entry.human_error = row.human_error;
            }
        }

        res.json({
            year,
            monthly: Array.from(monthMap.values()),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;