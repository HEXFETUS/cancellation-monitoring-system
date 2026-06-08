/**
 * Google Apps Script — Inventory Asset Sheet Reader
 *
 * Deploy this script as a Web App in your Google Sheet:
 *   Extensions → Apps Script → Paste this code → Deploy → New deployment → Web app
 *
 * FIXED:
 *   1. Single bulk read + backward JS scan eliminates trailing ghost rows
 *   2. CSV path now includes the header row so backend maps columns correctly
 *   3. Path B reads headers from the correct row (headerRowIndex, not +1)
 */

const SPREADSHEET_ID = "1BagmkvbfnwSf3SKgCx4C6GUiTdd_dEi5Mp-Q3qeL0L8";

// Safely grabs the token from your Script Properties settings
const SHARED_TOKEN =
  PropertiesService.getScriptProperties().getProperty("SHARED_TOKEN");

/**
 * PULL DATA (GET)
 * Leverages a strict per-sheet map index dictionary with high-capacity CSV routing.
 */
function doGet(e) {
  try {
    const token = e.parameter.token || "";
    if (SHARED_TOKEN && token !== SHARED_TOKEN) {
      return json({
        error: "UNAUTHORIZED",
        message: "Invalid or missing secure handshake token.",
      });
    }

    const sheetName = e.parameter.sheet;
    const type = e.parameter.type || "";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return type === "READ_TAB_CSV"
        ? ContentService.createTextOutput("").setMimeType(
            ContentService.MimeType.TEXT,
          )
        : json({ error: "TAB_NOT_FOUND", rows: [] });
    }

    // Explicit array index dictionary matching each tab to its exact header row
    const HEADER_ROW_BY_SHEET = {
      "Inventory - Asset": 5,
      "Assets Coding": 1,
      SUMMARY: 2,
    };

    const headerRowIndex =
      HEADER_ROW_BY_SHEET[sheetName] !== undefined
        ? HEADER_ROW_BY_SHEET[sheetName]
        : 0;
    const totalRows = sheet.getLastRow();
    const totalCols = sheet.getLastColumn();

    if (totalRows <= headerRowIndex) {
      return type === "READ_TAB_CSV"
        ? ContentService.createTextOutput("").setMimeType(
            ContentService.MimeType.TEXT,
          )
        : json({
            error: "HEADER_NOT_FOUND",
            message:
              "Target sheet has fewer rows than the mapped header index requires.",
          });
    }

    // ==========================================
    // PATH A: HIGH-CAPACITY UNLIMITED CSV STREAM
    // ==========================================
    if (type === "READ_TAB_CSV") {
      // Single bulk read: header row + all potential data rows in one call
      const maxDataRows = totalRows - headerRowIndex;
      const rawDataWithHeader = sheet
        .getRange(headerRowIndex, 1, maxDataRows + 1, totalCols)
        .getValues();

      // Scan backward through the JS array to find the last row with real data.
      // This eliminates trailing ghost rows without additional spreadsheet API hits.
      let lastValidIndex = rawDataWithHeader.length - 1;
      while (lastValidIndex > 0) {
        // always keep at least index 0 (the header)
        const rowToCheck = rawDataWithHeader[lastValidIndex];
        if (
          rowToCheck.some(function (cell) {
            return String(cell || "").trim() !== "";
          })
        ) {
          break; // Found the actual end of data
        }
        lastValidIndex--;
      }

      // Slice from header (index 0) through the last valid data row
      const cleanRawData = rawDataWithHeader.slice(0, lastValidIndex + 1);

      const csvString = cleanRawData
        .map(function (row) {
          return row
            .map(function (cell) {
              var s = String(cell || "");
              // Escape quotes, commas, and line breaks safely for RFC 4180 compliance
              if (
                s.indexOf(",") !== -1 ||
                s.indexOf('"') !== -1 ||
                s.indexOf("\n") !== -1 ||
                s.indexOf("\r") !== -1
              ) {
                return '"' + s.replace(/"/g, '""') + '"';
              }
              return s;
            })
            .join(",");
        })
        .join("\n");

      return ContentService.createTextOutput(csvString).setMimeType(
        ContentService.MimeType.TEXT,
      );
    }

    // ==========================================
    // PATH B: STANDARD JSON CHUNK FALLBACK
    // ==========================================
    // FIX: Use headerRowIndex directly (not +1) to read the actual header row
    const headers = sheet
      .getRange(headerRowIndex, 1, 1, totalCols)
      .getValues()[0]
      .map((h) => String(h || "").trim());
    if (!headers.some((h) => h !== "")) {
      return json({
        error: "HEADER_NOT_FOUND",
        message: "Target header row index appears to be completely empty.",
      });
    }

    const startRowParam = parseInt(e.parameter.startRow || "0", 10);
    const pageSizeParam = parseInt(e.parameter.pageSize || "0", 10);

    let rawRowsData;
    let hasMore = false;
    let nextRow = null;
    const absoluteDataStartRow = headerRowIndex + 2;

    if (startRowParam > 0 && pageSizeParam > 0) {
      const currentFetchStart = Math.max(absoluteDataStartRow, startRowParam);
      const rowsRemaining = totalRows - currentFetchStart + 1;

      if (rowsRemaining <= 0) {
        return json({ status: "success", rows: [], hasMore: false });
      }

      const chunkLimit = Math.min(pageSizeParam, rowsRemaining);
      rawRowsData = sheet
        .getRange(currentFetchStart, 1, chunkLimit, totalCols)
        .getValues();

      nextRow = currentFetchStart + chunkLimit;
      hasMore = nextRow <= totalRows;
    } else {
      const totalDataRowsToFetch = totalRows - absoluteDataStartRow + 1;
      if (totalDataRowsToFetch <= 0) {
        return json({ status: "success", rows: [] });
      }
      rawRowsData = sheet
        .getRange(absoluteDataStartRow, 1, totalDataRowsToFetch, totalCols)
        .getValues();
    }

    const rows = rawRowsData
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header) obj[header] = row[index];
        });
        return obj;
      });

    return json({
      status: "success",
      rows: rows,
      hasMore: hasMore,
      nextRow: nextRow,
    });
  } catch (err) {
    return e.parameter.type === "READ_TAB_CSV"
      ? ContentService.createTextOutput("").setMimeType(
          ContentService.MimeType.TEXT,
        )
      : json({ error: "INTERNAL_ERROR", message: err.toString() });
  }
}

/**
 * PUSH DATA (POST)
 */
function doPost(e) {
  return json({
    error: "WRITEBACK_DISABLED",
    message:
      "Sync interface is configured as Read-Only to protect structural row layers.",
  });
}

// Global output responder transformer
function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
