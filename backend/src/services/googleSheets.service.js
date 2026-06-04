import pool from "../config/db.js";

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
        `https://docs.google.com/spreadsheets/d/${ASSET_SPREADSHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`,
        `https://docs.google.com/spreadsheets/d/${ASSET_SPREADSHEET_ID}/export?gid=0&format=csv`,
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

    let rows;
    if (Array.isArray(sourceRows[0])) {
        // Raw values — the GAS returned a 2D grid. Try rowsFromSheetValues
        // first (looks for a real header row). If every row comes back empty
        // (header scan failed, e.g. empty cells in row 1), fall back to
        // treating the first row as the header manually, then object-map the
        // rest so we don't lose data.
        rows = rowsFromSheetValues(sourceRows);
        if (rows.every((row) => Object.keys(row).length === 0) && sourceRows.length > 1) {
            const rawHeaders = sourceRows[0].map(normalizeHeader);
            rows = sourceRows.slice(1).map((valuesRow) => {
                const row = {};
                rawHeaders.forEach((header, index) => {
                    if (header) row[header] = valuesRow?.[index] ?? "";
                });
                return row;
            });
        }
    } else {
        // Already object-mapped by the GAS
        rows = normalizeObjectRows(sourceRows);
    }

    if (sourceRows.length > 0 && rows.every((row) => Object.keys(row).length === 0)) {
        // Still empty after both attempts — log a warning and return empty
        // so the rest of the sync (other tabs) can proceed.
        console.warn(
            `GAS Web App returned ${sourceRows.length} rows for "${sheetName}" ` +
            `but none had recognisable headers. The tab will be skipped.`
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
    if (!["asset_inv", "asset_coding"].includes(tableName)) {
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
        a.serial_no AS serial_number,
               a.department,
               a.space,
               a.date_purchase,
               a.vendor,
        a.purchase_price_per_item AS purchase_price,
               a.warranty_date,
               a.quantity,
               a.discount,
               a.asset_value,
        a.asset_total AS total_value,
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
    FROM asset_inv a
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
               asset_id, created_at, updated_at
        FROM asset_coding
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
        COALESCE(SUM(asset_total), 0)::numeric(14,2) AS total_value
    FROM asset_inv
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
        // Don't trust the sheet to assign DB primary keys. Sheet's "ID"/"NO."
        // columns are row counters for humans, not foreign keys. Existing rows
        // are matched downstream by serial_number or (location, item_description).
        id: null,
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
    // The sheet's "ASSET ID" column is the canonical identifier for the
    // asset code (printed on stickers, scanned via QR). It is NOT a foreign
    // key into asset_inv. Treat it as the item_code and preserve the value
    // verbatim so QR lookups stay stable. Whitespace gets trimmed; nothing
    // else is rewritten.
    const itemCode = pick(row, [
        "Asset ID",
        "ID",
        "Item Code",
        "Code",
        "Asset Code",
    ]);
    const description = pick(row, ["Description", "Item Description", "Item"]);

    return {
        // asset_id (FK to asset_inv) is resolved later via description match
        // inside upsertAssetCodeFromSheet. Never read it from the sheet.
        item_code: itemCode,
        description,
        type: pick(row, ["Type", "Category"]) || null,
        department: pick(row, ["Department"]) || null,
        care_of: pick(row, ["Care Of", "Careof", "Custodian"]) || null,
        space: pick(row, ["Space", "Sub Location", "Sub-Location", "Room"]) || null,
        asset_id: null,
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
            FROM asset_inv
            WHERE LOWER(serial_no) = LOWER($1)
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
            FROM asset_inv
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
            INSERT INTO asset_inv (
                id, location, item_description, type, serial_no, department, space,
                date_purchase, vendor, purchase_price_per_item, warranty_date, quantity,
                discount, asset_value, asset_total, color, remarks, payout_station_id,
                office_department_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            ON CONFLICT (id) DO UPDATE
            SET location = EXCLUDED.location,
                item_description = EXCLUDED.item_description,
                type = EXCLUDED.type,
                serial_no = EXCLUDED.serial_no,
                department = EXCLUDED.department,
                space = EXCLUDED.space,
                date_purchase = EXCLUDED.date_purchase,
                vendor = EXCLUDED.vendor,
                purchase_price_per_item = EXCLUDED.purchase_price_per_item,
                warranty_date = EXCLUDED.warranty_date,
                quantity = EXCLUDED.quantity,
                discount = EXCLUDED.discount,
                asset_value = EXCLUDED.asset_value,
                asset_total = EXCLUDED.asset_total,
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
        INSERT INTO asset_inv (
            location, item_description, type, serial_no, department, space,
            date_purchase, vendor, purchase_price_per_item, warranty_date, quantity,
            discount, asset_value, asset_total, color, remarks, payout_station_id,
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

async function findAssetIdByDescription(client, description) {
    if (!description) return null;
    const result = await client.query(
        `SELECT id FROM asset_inv
         WHERE LOWER(item_description) = LOWER($1)
         ORDER BY id ASC LIMIT 1`,
        [description]
    );
    return result.rows[0]?.id || null;
}

async function upsertAssetCodeFromSheet(client, row) {
    const assetCode = sheetAssetCodeToDbRow(row);

    // If both item_code and description are missing there's nothing useful to
    // import, so skip the row entirely.
    if (!assetCode.item_code && !assetCode.description) {
        return { skipped: true, reason: "Missing ASSET ID and description" };
    }

    // Best-effort link to asset_inv by description match. Null is fine —
    // the FK is nullable on the new schema and CASCADE-deletes when set.
    assetCode.asset_id = assetCode.description
        ? await findAssetIdByDescription(client, assetCode.description)
        : null;

    if (assetCode.item_code) {
        // Row has an item_code — manually check if it exists first, then
        // INSERT or UPDATE (no UNIQUE constraint on item_code any more since
        // the column was made nullable, so ON CONFLICT won't work).
        const existing = await client.query(
            `SELECT id FROM asset_coding WHERE item_code = $1 LIMIT 1`,
            [assetCode.item_code]
        );

        if (existing.rows.length > 0) {
            await client.query(
                `
                UPDATE asset_coding
                SET description = $1,
                    type = $2,
                    department = $3,
                    care_of = $4,
                    space = $5,
                    asset_id = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7
                `,
                [
                    assetCode.description,
                    assetCode.type,
                    assetCode.department,
                    assetCode.care_of,
                    assetCode.space,
                    assetCode.asset_id,
                    existing.rows[0].id,
                ]
            );
            return { updated: true };
        }

        await client.query(
            `
            INSERT INTO asset_coding (
                item_code, description, type, department, care_of, space, asset_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7
            )
            `,
            [
                assetCode.item_code,
                assetCode.description,
                assetCode.type,
                assetCode.department,
                assetCode.care_of,
                assetCode.space,
                assetCode.asset_id,
            ]
        );

        return { inserted: true };
    }

    // Row has no item_code (ASSET ID is empty) but has description — do a plain
    // INSERT without ON CONFLICT since the UNIQUE constraint doesn't apply to NULL.
    await client.query(
        `
        INSERT INTO asset_coding (
            item_code, description, type, department, care_of, space, asset_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
        )
        `,
        [
            null,
            assetCode.description,
            assetCode.type,
            assetCode.department,
            assetCode.care_of,
            assetCode.space,
            assetCode.asset_id,
        ]
    );

    return { inserted: true };
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

        await syncSerialSequence(client, "asset_inv");

        for (const row of assetCodeSheetRows) {
            addOutcome(
                summary.tabs[ASSET_SHEET_NAMES.assetCodes],
                await upsertAssetCodeFromSheet(client, row)
            );
        }

        await syncSerialSequence(client, "asset_coding");
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
