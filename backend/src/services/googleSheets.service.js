import pool from "../config/db.js";
import crypto from "node:crypto";

const DEFAULT_ASSET_SPREADSHEET_ID = "1BagmkvbfnwSf3SKgCx4C6GUiTdd_dEi5Mp-Q3qeL0L8";
const ASSET_SHEET_URL = process.env.ASSET_INVENTORY_SHEET_URL;
const ASSET_SHEET_TOKEN = process.env.ASSET_INVENTORY_SHEET_TOKEN;

export const ASSET_SPREADSHEET_ID =
    process.env.ASSET_INVENTORY_SPREADSHEET_ID || DEFAULT_ASSET_SPREADSHEET_ID;

export const ASSET_SPREADSHEET_URL =
    process.env.ASSET_INVENTORY_SPREADSHEET_URL ||
    `https://docs.google.com/spreadsheets/d/${ASSET_SPREADSHEET_ID}/edit`;

export const ASSET_LOCATIONS = new Set([
    "office",
    "payout",
    "drawcourt",
    "obs",
    "staffhouse",
    "vehicle",
]);

export const ASSET_SHEET_NAMES = {
    assets: "Inventory - Asset",
    assetCodes: "Assets Coding",
    summary: "SUMMARY",
};

export const ASSET_HEADERS = [
    "ID",
    "Location",
    "Item Description",
    "Type",
    "Serial Number",
    "Department",
    "Space",
    "Date Purchased",
    "Vendor",
    "Purchase Price",
    "Warranty Date",
    "Quantity",
    "Discount",
    "Asset Value",
    "Total Value",
    "Color",
    "Remarks",
    "Payout Station",
    "Office Department",
    "Created At",
    "Updated At",
];

export const ASSET_CODE_HEADERS = [
    "ID",
    "Item Code",
    "Description",
    "Type",
    "Department",
    "Care Of",
    "Space",
    "QR Payload",
    "Linked Asset ID",
    "Created At",
    "Updated At",
];

export const REFERENCE_HEADERS = [
    "ID",
    "Code",
    "Name",
    "Description",
    "Active",
    "Created At",
    "Updated At",
];

export const SUMMARY_HEADERS = [
    "Location",
    "Asset Count",
    "Total Quantity",
    "Total Value",
];

function requireSheetUrl() {
    if (!ASSET_SHEET_URL) {
        throw new Error("ASSET_INVENTORY_SHEET_URL is not configured");
    }

    return ASSET_SHEET_URL;
}

function value(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    return value;
}

function dateValue(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
}

function decimalValue(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function assertLocation(location) {
    if (location && !ASSET_LOCATIONS.has(location)) {
        throw new Error(`Location must be one of: ${Array.from(ASSET_LOCATIONS).join(", ")}`);
    }
}

function normalizeHeader(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function pick(row, names) {
    for (const name of names) {
        const value = row[normalizeHeader(name)];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }

    return "";
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const next = text[i + 1];

        if (quoted && ch === "\"" && next === "\"") {
            cell += "\"";
            i += 1;
            continue;
        }

        if (ch === "\"") {
            quoted = !quoted;
            continue;
        }

        if (!quoted && ch === ",") {
            row.push(cell);
            cell = "";
            continue;
        }

        if (!quoted && (ch === "\n" || ch === "\r")) {
            if (ch === "\r" && next === "\n") i += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
            continue;
        }

        cell += ch;
    }

    row.push(cell);
    rows.push(row);

    return rows.filter((values) => values.some((item) => String(item || "").trim()));
}

function toObjects(csvRows) {
    if (csvRows.length === 0) return [];

    const headers = csvRows[0].map(normalizeHeader);
    return csvRows.slice(1).map((values) => {
        const row = {};
        headers.forEach((header, index) => {
            if (header) row[header] = values[index] ?? "";
        });
        return row;
    });
}

function normalizeObjectRows(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map((source) => {
        const row = {};
        Object.entries(source || {}).forEach(([key, value]) => {
            row[normalizeHeader(key)] = value ?? "";
        });
        return row;
    });
}

function rowsFromSheetValues(values) {
    if (!Array.isArray(values) || values.length === 0) return [];

    const headerIndex = values.findIndex((row) =>
        Array.isArray(row) &&
        row.some((cell) => String(cell || "").trim())
    );
    if (headerIndex === -1) return [];

    const headers = values[headerIndex].map(normalizeHeader);
    return values.slice(headerIndex + 1).map((valuesRow) => {
        const row = {};
        headers.forEach((header, index) => {
            if (header) row[header] = valuesRow?.[index] ?? "";
        });
        return row;
    });
}

function parseNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const cleaned = String(value).replace(/[^0-9.-]+/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
}

function parseInteger(value, fallback = 0) {
    return Math.floor(parseNumber(value, fallback));
}

function parseId(value) {
    const id = parseInteger(value, 0);
    return id > 0 ? id : null;
}

function parseDateOrNull(value) {
    if (!value) return null;

    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().slice(0, 10);
}

function parseLocation(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return null;

    // Direct enum hit first (cheap path).
    if (ASSET_LOCATIONS.has(normalized)) return normalized;

    // Fuzzy matching for the verbose strings that show up in the spreadsheet
    // (e.g. "MAIN OFFICE", "OBS OFFICE", "PCSO PAYOUT STATION"). Order
    // matters here: more specific tokens before generic ones, so "obs office"
    // resolves to "obs" rather than the catch-all "office" branch.
    if (normalized.includes("obs")) return "obs";
    if (normalized.includes("draw")) return "drawcourt";
    if (normalized.includes("payout") || normalized.includes("pcso")) return "payout";
    if (normalized.includes("staff")) return "staffhouse";
    if (normalized.includes("vehicle") || normalized.includes("car")) return "vehicle";
    if (normalized.includes("office")) return "office";
    return null;
}

// Asset Coding rows in the Google Sheet are bare descriptions — there's no
// Item Code column. We mint one server-side that's stable per (description, id)
// pair so re-runs don't churn through duplicates. Format keeps a short prefix
// and zero-padded counter for readability on stickers.
function buildSyntheticItemCode(prefix, sequence) {
    const safePrefix = String(prefix || "ITEM")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4) || "ITEM";
    const numeric = String(sequence).padStart(4, "0");
    return `${safePrefix}-${numeric}`;
}

function generateQrPayload(itemCode) {
    const code = String(itemCode || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    return code ? `ASSET-${code}-${suffix}` : `ASSET-${suffix}`;
}

async function fetchSheetRowsByName(sheetName) {
    // First try: GAS Web App (supports bidirectional sync)
    if (ASSET_SHEET_URL) {
        try {
            return await fetchSheetRowsByNameFromWebApp(sheetName);
        } catch (_webAppErr) {
            console.warn(
                `GAS Web App failed for "${sheetName}", falling back to CSV export: ${_webAppErr.message}`
            );
        }
    }

    // Second try: CSV export (works when sheet is shared "Anyone with the link")
    for (const csvUrl of [
        `https://docs.google.com/spreadsheets/d/${ASSET_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
        `https://docs.google.com/spreadsheets/d/${ASSET_SPREADSHEET_ID}/export?format=csv`,
    ]) {
        try {
            const response = await fetch(csvUrl);
            const text = await response.text();

            if (!response.ok) continue;

            if (/^<!doctype html/i.test(text.trim()) || text.includes("<title>")) {
                continue;
            }

            const rows = toObjects(parseCsv(text));
            if (rows.length === 0) continue;

            return rows;
        } catch {
            continue;
        }
    }

    // Last resort: return empty rows with a warning so the sync can continue
    // for tabs that ARE readable. This prevents a single unreadable tab from
    // blocking the entire sync.
    console.warn(
        `Could not read "${sheetName}" from Google Sheets via ANY export method. ` +
        `Check that the spreadsheet is shared with "Anyone with the link" as Viewer. ` +
        `Syncing this tab will be skipped.`
    );
    return [];
}

async function fetchSheetRowsByNameFromWebApp(sheetName) {
    const url = new URL(ASSET_SHEET_URL);
    url.searchParams.set("type", "READ_TAB");
    url.searchParams.set("sheet", sheetName);
    url.searchParams.set("spreadsheet_id", ASSET_SPREADSHEET_ID);
    if (ASSET_SHEET_TOKEN) url.searchParams.set("token", ASSET_SHEET_TOKEN);

    const response = await fetch(url, {
        headers: ASSET_SHEET_TOKEN ? { "X-SHEET-TOKEN": ASSET_SHEET_TOKEN } : {},
    });
    const text = await response.text();

    if (!response.ok) {
        throw new Error(`Failed to read "${sheetName}" from Google Sheets Web App: HTTP ${response.status}`);
    }

    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error(`Google Sheets Web App did not return JSON for "${sheetName}": ${text.slice(0, 120)}`);
    }

    if (payload.error || payload.status === "error") {
        throw new Error(payload.error || payload.message || `Google Sheets Web App failed for "${sheetName}"`);
    }

    const sourceRows =
        payload.rows ||
        payload.data ||
        payload.workbook?.[sheetName] ||
        [];

    const rows = Array.isArray(sourceRows[0])
        ? rowsFromSheetValues(sourceRows)
        : normalizeObjectRows(sourceRows);

    if (sourceRows.length > 0 && rows.every((row) => Object.keys(row).length === 0)) {
        throw new Error(
            `Google Sheets Web App returned ${sourceRows.length} empty rows for "${sheetName}". Check the Apps Script response: it must return header-mapped objects or raw sheet values with a real header row.`
        );
    }

    return rows;
}

async function findPayoutStationId(client, station) {
    if (!station) return null;

    const result = await client.query(
        `
        SELECT id
        FROM payout_stations
        WHERE LOWER(station_code) = LOWER($1)
           OR LOWER(name) = LOWER($1)
        LIMIT 1
        `,
        [station]
    );

    return result.rows[0]?.id || null;
}

async function findOfficeDepartmentId(client, department) {
    if (!department) return null;

    const result = await client.query(
        `
        SELECT id
        FROM office_departments
        WHERE LOWER(dept_code) = LOWER($1)
           OR LOWER(name) = LOWER($1)
        LIMIT 1
        `,
        [department]
    );

    return result.rows[0]?.id || null;
}

async function syncSerialSequence(client, tableName) {
    if (!["assets", "asset_codes"].includes(tableName)) {
        throw new Error(`Cannot sync unknown asset table sequence: ${tableName}`);
    }

    await client.query(
        `
        SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1,
            false
        )
        `,
        [tableName]
    );
}

export function mapAssetToSheetRow(row) {
    return [
        row.id,
        row.location,
        row.item_description,
        value(row.type),
        value(row.serial_number),
        value(row.department),
        value(row.space),
        dateValue(row.date_purchase),
        value(row.vendor),
        decimalValue(row.purchase_price),
        dateValue(row.warranty_date),
        Number(row.quantity || 0),
        decimalValue(row.discount),
        decimalValue(row.asset_value),
        decimalValue(row.total_value),
        value(row.color),
        value(row.remarks),
        value(row.payout_station_name || row.payout_station_code),
        value(row.office_department_name || row.office_department_code),
        value(row.created_at),
        value(row.updated_at),
    ];
}

export function mapAssetCodeToSheetRow(row) {
    return [
        row.id,
        row.item_code,
        row.description,
        value(row.type),
        value(row.department),
        value(row.care_of),
        value(row.space),
        row.qr_payload,
        value(row.asset_id),
        value(row.created_at),
        value(row.updated_at),
    ];
}

export function mapReferenceToSheetRow(row, codeField) {
    return [
        row.id,
        row[codeField],
        row.name,
        value(row.description),
        row.active === false ? "FALSE" : "TRUE",
        value(row.created_at),
        value(row.updated_at),
    ];
}

export function mapSummaryToSheetRow(row) {
    return [
        row.location,
        Number(row.asset_count || 0),
        Number(row.total_quantity || 0),
        decimalValue(row.total_value),
    ];
}

export async function getAssetRows({ location } = {}) {
    assertLocation(location);

    const where = location ? "WHERE a.location = $1" : "";
    const params = location ? [location] : [];
    const result = await pool.query(
        `
        SELECT a.id,
               a.location,
               a.item_description,
               a.type,
               a.serial_number,
               a.department,
               a.space,
               a.date_purchase,
               a.vendor,
               a.purchase_price,
               a.warranty_date,
               a.quantity,
               a.discount,
               a.asset_value,
               a.total_value,
               a.color,
               a.remarks,
               a.payout_station_id,
               ps.station_code AS payout_station_code,
               ps.name AS payout_station_name,
               a.office_department_id,
               od.dept_code AS office_department_code,
               od.name AS office_department_name,
               a.created_at,
               a.updated_at
        FROM assets a
        LEFT JOIN payout_stations ps ON ps.id = a.payout_station_id
        LEFT JOIN office_departments od ON od.id = a.office_department_id
        ${where}
        ORDER BY a.location ASC, a.id DESC
        `,
        params
    );

    return result.rows;
}

export async function getAssetCodeRows() {
    const result = await pool.query(
        `
        SELECT id, item_code, description, type, department, care_of, space,
               qr_payload, asset_id, created_at, updated_at
        FROM asset_codes
        ORDER BY item_code ASC
        `
    );

    return result.rows;
}

export async function getPayoutStationRows() {
    const result = await pool.query(
        `
        SELECT id, station_code, name, description, active, created_at, updated_at
        FROM payout_stations
        ORDER BY station_code ASC
        `
    );

    return result.rows;
}

export async function getOfficeDepartmentRows() {
    const result = await pool.query(
        `
        SELECT id, dept_code, name, description, active, created_at, updated_at
        FROM office_departments
        ORDER BY dept_code ASC
        `
    );

    return result.rows;
}

export async function getAssetSummaryRows() {
    const result = await pool.query(
        `
        SELECT location,
               COUNT(*)::int AS asset_count,
               COALESCE(SUM(quantity), 0)::int AS total_quantity,
               COALESCE(SUM(total_value), 0)::numeric(14,2) AS total_value
        FROM assets
        GROUP BY location
        ORDER BY location ASC
        `
    );

    return result.rows;
}

export async function buildAssetInventorySheets({ location } = {}) {
    const [assets, assetCodes, summary] = await Promise.all([
        getAssetRows({ location }),
        getAssetCodeRows(),
        getAssetSummaryRows(),
    ]);

    return [
        {
            name: ASSET_SHEET_NAMES.assets,
            headers: ASSET_HEADERS,
            rows: assets.map(mapAssetToSheetRow),
        },
        {
            name: ASSET_SHEET_NAMES.assetCodes,
            headers: ASSET_CODE_HEADERS,
            rows: assetCodes.map(mapAssetCodeToSheetRow),
        },
        {
            name: ASSET_SHEET_NAMES.summary,
            headers: SUMMARY_HEADERS,
            rows: summary.map(mapSummaryToSheetRow),
        },
    ];
}

function sheetAssetToDbRow(row) {
    const location = parseLocation(pick(row, ["Location", "Area", "Section"]));
    const itemDescription = pick(row, ["Item Description", "Description", "Item", "Asset"]);
    const quantity = Math.max(1, parseInteger(pick(row, ["Quantity", "Qty"]), 1));
    const purchasePrice = parseNumber(
        pick(row, [
            "Purchase Price",
            "Purchase Price Per Item",
            "Price",
            "Cost",
        ]),
        0
    );
    const discount = parseNumber(pick(row, ["Discount"]), 0);
    const assetValue =
        pick(row, ["Asset Value", "Value"]) === ""
            ? Math.max(0, purchasePrice - discount)
            : parseNumber(pick(row, ["Asset Value", "Value"]), 0);

    return {
        id: parseId(pick(row, ["ID", "Asset ID", "Purchase No", "No"])),
        location,
        item_description: itemDescription,
        type: pick(row, ["Type", "Category"]) || null,
        serial_number:
            pick(row, ["Serial Number", "Serial No", "Serial No.", "Serial"]) || null,
        department: pick(row, ["Department"]) || null,
        space: pick(row, ["Space", "Sub Location", "Sub-Location", "Room"]) || null,
        date_purchase: parseDateOrNull(
            pick(row, [
                "Date Purchased",
                "Date Purchase",
                "Date Of Purchase",
                "Purchase Date",
            ])
        ),
        vendor: pick(row, ["Vendor", "Supplier"]) || null,
        purchase_price: purchasePrice,
        warranty_date: parseDateOrNull(
            pick(row, ["Warranty Date", "Warranty Expiry Date", "Warranty"])
        ),
        quantity,
        discount,
        asset_value: assetValue,
        total_value: assetValue * quantity,
        color: pick(row, ["Color"]) || null,
        remarks: pick(row, ["Remarks", "Notes"]) || null,
        payout_station: pick(row, ["Payout Station", "Station", "Outlet"]),
        office_department: pick(row, ["Office Department", "Department"]),
    };
}

function sheetAssetCodeToDbRow(row) {
    const itemCode = pick(row, ["Item Code", "Code", "Asset Code"]);
    const description = pick(row, ["Description", "Item Description", "Item"]);

    return {
        id: parseId(pick(row, ["Asset Code ID"])),
        item_code: itemCode,
        description,
        type: pick(row, ["Type", "Category"]) || null,
        department: pick(row, ["Department"]) || null,
        care_of: pick(row, ["Care Of", "Careof", "Custodian"]) || null,
        space: pick(row, ["Space", "Sub Location", "Sub-Location", "Room"]) || null,
        qr_payload: pick(row, ["QR Payload", "QR", "QR Code"]) || null,
        // Linked-to-asset id is read from the sheet's "ASSET ID" or
        // "Linked Asset ID" cell. Decoupled from the asset code's own primary
        // key (which we read separately as "Asset Code ID") so a row that
        // only carries an ASSET ID doesn't collide with the auto-generated
        // item_code logic in the upsert.
        asset_id: parseId(pick(row, ["Linked Asset ID", "Asset ID", "ID"])),
    };
}

async function upsertAssetFromSheet(client, row) {
    const asset = sheetAssetToDbRow(row);

    if (!asset.location || !asset.item_description) {
        return { skipped: true, reason: "Missing location or item description" };
    }

    const payoutStationId = await findPayoutStationId(client, asset.payout_station);
    const officeDepartmentId = await findOfficeDepartmentId(client, asset.office_department);

    if (!asset.id && asset.serial_number) {
        const existing = await client.query(
            `
            SELECT id
            FROM assets
            WHERE LOWER(serial_number) = LOWER($1)
            LIMIT 1
            `,
            [asset.serial_number]
        );
        asset.id = existing.rows[0]?.id || null;
    }

    if (!asset.id) {
        const existing = await client.query(
            `
            SELECT id
            FROM assets
            WHERE location = $1
              AND LOWER(item_description) = LOWER($2)
            LIMIT 1
            `,
            [asset.location, asset.item_description]
        );
        asset.id = existing.rows[0]?.id || null;
    }

    if (asset.id) {
        const result = await client.query(
            `
            INSERT INTO assets (
                id, location, item_description, type, serial_number, department, space,
                date_purchase, vendor, purchase_price, warranty_date, quantity,
                discount, asset_value, total_value, color, remarks, payout_station_id,
                office_department_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            ON CONFLICT (id) DO UPDATE
            SET location = EXCLUDED.location,
                item_description = EXCLUDED.item_description,
                type = EXCLUDED.type,
                serial_number = EXCLUDED.serial_number,
                department = EXCLUDED.department,
                space = EXCLUDED.space,
                date_purchase = EXCLUDED.date_purchase,
                vendor = EXCLUDED.vendor,
                purchase_price = EXCLUDED.purchase_price,
                warranty_date = EXCLUDED.warranty_date,
                quantity = EXCLUDED.quantity,
                discount = EXCLUDED.discount,
                asset_value = EXCLUDED.asset_value,
                total_value = EXCLUDED.total_value,
                color = EXCLUDED.color,
                remarks = EXCLUDED.remarks,
                payout_station_id = EXCLUDED.payout_station_id,
                office_department_id = EXCLUDED.office_department_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING (xmax = 0) AS inserted
            `,
            [
                asset.id,
                asset.location,
                asset.item_description,
                asset.type,
                asset.serial_number,
                asset.department,
                asset.space,
                asset.date_purchase,
                asset.vendor,
                asset.purchase_price,
                asset.warranty_date,
                asset.quantity,
                asset.discount,
                asset.asset_value,
                asset.total_value,
                asset.color,
                asset.remarks,
                payoutStationId,
                officeDepartmentId,
            ]
        );

        return result.rows[0]?.inserted ? { inserted: true } : { updated: true };
    }

    await client.query(
        `
        INSERT INTO assets (
            location, item_description, type, serial_number, department, space,
            date_purchase, vendor, purchase_price, warranty_date, quantity,
            discount, asset_value, total_value, color, remarks, payout_station_id,
            office_department_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        `,
        [
            asset.location,
            asset.item_description,
            asset.type,
            asset.serial_number,
            asset.department,
            asset.space,
            asset.date_purchase,
            asset.vendor,
            asset.purchase_price,
            asset.warranty_date,
            asset.quantity,
            asset.discount,
            asset.asset_value,
            asset.total_value,
            asset.color,
            asset.remarks,
            payoutStationId,
            officeDepartmentId,
        ]
    );

    return { inserted: true };
}

async function nextAvailableItemCode(client) {
    // Hand out fresh "ITEM-NNNN" identifiers for sheet rows that don't
    // include an Item Code column. Picks the next number after whatever's
    // already in the table, so reruns don't fight over the same code. For an
    // empty table this returns "ITEM-0001".
    const result = await client.query(
        `
        SELECT COALESCE(
            MAX(NULLIF(regexp_replace(item_code, '[^0-9]', '', 'g'), ''))::int,
            0
        ) + 1 AS next
        FROM asset_codes
        WHERE item_code ~ '^ITEM-[0-9]+$'
        `
    );
    return buildSyntheticItemCode("ITEM", result.rows[0]?.next || 1);
}

async function upsertAssetCodeFromSheet(client, row) {
    const assetCode = sheetAssetCodeToDbRow(row);

    if (!assetCode.description) {
        return { skipped: true, reason: "Missing description" };
    }

    // Sheet doesn't carry an Item Code column today, so we either reuse an
    // existing row that matches description+department (idempotent re-runs)
    // or mint a fresh "ITEM-NNNN" code. Same path covers both cases.
    if (!assetCode.item_code) {
        const existing = await client.query(
            `
            SELECT item_code
            FROM asset_codes
            WHERE LOWER(description) = LOWER($1)
              AND COALESCE(LOWER(department), '') = COALESCE(LOWER($2), '')
            ORDER BY id ASC
            LIMIT 1
            `,
            [assetCode.description, assetCode.department]
        );

        if (existing.rows[0]?.item_code) {
            assetCode.item_code = existing.rows[0].item_code;
        } else {
            assetCode.item_code = await nextAvailableItemCode(client);
        }
    }

    if (!assetCode.qr_payload) {
        assetCode.qr_payload = generateQrPayload(assetCode.item_code);
    }

    const result = await client.query(
        `
        INSERT INTO asset_codes (
            item_code, description, type, department, care_of, space, qr_payload, asset_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (item_code) DO UPDATE
        SET description = EXCLUDED.description,
            type = EXCLUDED.type,
            department = EXCLUDED.department,
            care_of = EXCLUDED.care_of,
            space = EXCLUDED.space,
            asset_id = EXCLUDED.asset_id,
            updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserted
        `,
        [
            assetCode.item_code,
            assetCode.description,
            assetCode.type,
            assetCode.department,
            assetCode.care_of,
            assetCode.space,
            assetCode.qr_payload,
            assetCode.asset_id,
        ]
    );

    return result.rows[0]?.inserted ? { inserted: true } : { updated: true };
}

function addOutcome(summary, outcome) {
    if (outcome.inserted) summary.inserted += 1;
    else if (outcome.updated) summary.updated += 1;
    else if (outcome.skipped) summary.skipped += 1;
}

export async function syncAssetInventoryFromGoogleSheets() {
    const [assetSheetRows, assetCodeSheetRows] = await Promise.all([
        fetchSheetRowsByName(ASSET_SHEET_NAMES.assets),
        fetchSheetRowsByName(ASSET_SHEET_NAMES.assetCodes),
    ]);

    const client = await pool.connect();
    const summary = {
        spreadsheet_id: ASSET_SPREADSHEET_ID,
        tabs: {
            [ASSET_SHEET_NAMES.assets]: {
                scanned: assetSheetRows.length,
                inserted: 0,
                updated: 0,
                skipped: 0,
            },
            [ASSET_SHEET_NAMES.assetCodes]: {
                scanned: assetCodeSheetRows.length,
                inserted: 0,
                updated: 0,
                skipped: 0,
            },
        },
    };

    try {
        await client.query("BEGIN");

        for (const row of assetSheetRows) {
            addOutcome(
                summary.tabs[ASSET_SHEET_NAMES.assets],
                await upsertAssetFromSheet(client, row)
            );
        }

        await syncSerialSequence(client, "assets");

        for (const row of assetCodeSheetRows) {
            addOutcome(
                summary.tabs[ASSET_SHEET_NAMES.assetCodes],
                await upsertAssetCodeFromSheet(client, row)
            );
        }

        await syncSerialSequence(client, "asset_codes");
        await client.query("COMMIT");

        return summary;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

export async function syncAssetInventoryBothWays() {
    const fromGoogleSheets = await syncAssetInventoryFromGoogleSheets();
    let toGoogleSheets = null;

    if (ASSET_SHEET_URL) {
        toGoogleSheets = await syncAssetInventoryToGoogleSheets();
    }

    return {
        spreadsheet_id: ASSET_SPREADSHEET_ID,
        mode: "two-way",
        rule: "Google Sheet rows are imported first, then database rows are exported back so both sides match.",
        from_google_sheets: fromGoogleSheets,
        to_google_sheets: toGoogleSheets,
        write_configured: Boolean(ASSET_SHEET_URL),
    };
}

async function postToAssetSheet(payload) {
    const response = await fetch(requireSheetUrl(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(ASSET_SHEET_TOKEN ? { "X-SHEET-TOKEN": ASSET_SHEET_TOKEN } : {}),
        },
        body: JSON.stringify({
            ...(ASSET_SHEET_TOKEN ? { token: ASSET_SHEET_TOKEN } : {}),
            ...payload,
        }),
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Asset inventory sheet sync failed with HTTP ${response.status}: ${text}`);
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return { ok: true, message: text };
    }

    if (data.error || data.status === "error") {
        throw new Error(data.error || data.message || "Google Sheets Web App returned an error");
    }

    return data;
}

export async function syncAssetInventoryToGoogleSheets(options = {}) {
    const sheets = await buildAssetInventorySheets(options);

    return postToAssetSheet({
        type: "ASSET_INVENTORY_SYNC",
        spreadsheet_id: ASSET_SPREADSHEET_ID,
        synced_at: new Date().toISOString(),
        sheets,
    });
}

export async function syncAssetsToGoogleSheets(options = {}) {
    const assets = await getAssetRows(options);

    return postToAssetSheet({
        type: "ASSETS_SYNC",
        spreadsheet_id: ASSET_SPREADSHEET_ID,
        synced_at: new Date().toISOString(),
        sheet: {
            name: ASSET_SHEET_NAMES.assets,
            headers: ASSET_HEADERS,
            rows: assets.map(mapAssetToSheetRow),
        },
    });
}

export default {
    ASSET_CODE_HEADERS,
    ASSET_HEADERS,
    ASSET_LOCATIONS,
    ASSET_SPREADSHEET_ID,
    ASSET_SPREADSHEET_URL,
    ASSET_SHEET_NAMES,
    REFERENCE_HEADERS,
    SUMMARY_HEADERS,
    buildAssetInventorySheets,
    getAssetCodeRows,
    getAssetRows,
    getAssetSummaryRows,
    getOfficeDepartmentRows,
    getPayoutStationRows,
    mapAssetCodeToSheetRow,
    mapAssetToSheetRow,
    mapReferenceToSheetRow,
    mapSummaryToSheetRow,
    syncAssetInventoryBothWays,
    syncAssetInventoryFromGoogleSheets,
    syncAssetInventoryToGoogleSheets,
    syncAssetsToGoogleSheets,
};
