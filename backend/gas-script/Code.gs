var CANCELLED_BY_MAP = {
  "IT - Stefanie Obenza": "STEF",
  "IT - Michael Romo": "MIKE",
  "IT Area Manager - Kedev": "KHEDEV",
  "IT Supervisor - Richfield James P. Villanueva": "TROY",
};

var ssId = "1paJpEthoyCLARY0gc9oiUHdxprBm_HXqJk4qLRwHxh4";
var LARAVEL_API_URL =
  "https://hexaprimesystemporject.gamer.gd/api/v1/google-sheet-data";
var SHEET_API_TOKEN = "mikee.zip-secrettoken.gov.ph";

// ------------------------
// Format date for MySQL
// ------------------------
function formatForMySQL(datetime) {
  var jsDate = new Date(datetime);
  return (
    jsDate.getFullYear() +
    "-" +
    String(jsDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(jsDate.getDate()).padStart(2, "0") +
    " " +
    String(jsDate.getHours()).padStart(2, "0") +
    ":" +
    String(jsDate.getMinutes()).padStart(2, "0") +
    ":" +
    String(jsDate.getSeconds()).padStart(2, "0")
  );
}

// ------------------------
// POST Webhook — Save APPROVAL or REQUEST
// ------------------------
function doPost(e) {
  try {
    if (!e || !e.postData)
      return ContentService.createTextOutput("⚠️ No post data");

    var data = JSON.parse(e.postData.contents);
    Logger.log("📝 doPost received payload: " + JSON.stringify(data));

    var type = (data.type || "").toUpperCase();
    if (!type && (!data.status || data.status.trim() === "")) {
      type = "REQUEST";
    }

    Logger.log("📝 detected type after fallback: " + type);

    var date = data.date || new Date();
    var ticket = data.ticket || "";
    var refcode = data.refcode || "";
    var booth = (data.booth || "").trim();
    var boothUpper = booth.toUpperCase();

    // -----------------------------
    // DETERMINE AREA
    // -----------------------------
    var area = "Unknown";
    if (
      boothUpper.startsWith("CDO") ||
      boothUpper.startsWith("R.CDO") ||
      boothUpper.startsWith("CDO-PAY")
    ) {
      area = "CDO";
    } else if (
      boothUpper.startsWith("MOE") ||
      boothUpper.startsWith("MOW") ||
      boothUpper.startsWith("R.MOE") ||
      boothUpper.startsWith("R.MOW") ||
      boothUpper.startsWith("MOE-PAY") ||
      boothUpper.startsWith("MOW-PAY")
    ) {
      area = "MISOR";
    }

    var ss = SpreadsheetApp.openById(ssId);

    // ------------------------
    // REQUEST → Save to <AREA> REQUEST sheet
    // ------------------------
    if (type === "REQUEST") {
      var sheetName = area + " REQUEST";
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      // Always ensure headers exist (handles old sheets missing columns)
      ensureRequestHeaders(sheet);

      sheet.appendRow([
        new Date(date),
        ticket,
        refcode,
        boothUpper,
        area,
        "NO",
      ]);

      Logger.log("🟦 Saved REQUEST row → " + sheetName);
      return ContentService.createTextOutput("✅ REQUEST logged");
    }

    // ------------------------
    // UPDATE_REASON — Update the reason for an existing ticket's row
    // ------------------------
    if (type === "UPDATE_REASON") {
      var updateSheetName = data.area || "";
      var updateTicket = data.ticket || "";
      var updateReason = data.reason_denied_ticket || data.reason || "";

      if (!updateSheetName || !updateTicket || !updateReason) {
        return ContentService.createTextOutput("❌ Missing area, ticket, or reason");
      }

      var updateSs = SpreadsheetApp.openById(ssId);
      var targetSheet = updateSs.getSheetByName(updateSheetName);

      if (!targetSheet) {
        return ContentService.createTextOutput("❌ Sheet not found: " + updateSheetName);
      }

      ensureHeaders(targetSheet);
      var updateData = targetSheet.getDataRange().getValues();
      var updateHeaders = updateData[0];

      // Find REASON FOR DENIED TICKET column
      var reasonColIndex = -1;
      for (var c = 0; c < updateHeaders.length; c++) {
        var headerText = String(updateHeaders[c] || "").trim().toUpperCase();
        if (headerText === "REASON FOR DENIED TICKET") {
          reasonColIndex = c;
          break;
        }
      }

      if (reasonColIndex === -1) {
        return ContentService.createTextOutput("❌ REASON FOR DENIED TICKET column not found");
      }

      // Find TICKET NUMBER column
      var ticketColIndex = -1;
      for (var c = 0; c < updateHeaders.length; c++) {
        var headerText = String(updateHeaders[c] || "").trim().toUpperCase();
        if (headerText === "TICKET NUMBER") {
          ticketColIndex = c;
          break;
        }
      }

      if (ticketColIndex === -1) {
        return ContentService.createTextOutput("❌ TICKET NUMBER column not found");
      }

      // Find REFERENCE CODE column (for fallback matching)
      var refColIndex = -1;
      for (var c = 0; c < updateHeaders.length; c++) {
        var refHeader = String(updateHeaders[c] || "").trim().toUpperCase();
        if (refHeader === "REFERENCE CODE") {
          refColIndex = c;
          break;
        }
      }

      // Find STATUS column (column E) for validation
      var statusColIndex = -1;
      for (var c = 0; c < updateHeaders.length; c++) {
        if (String(updateHeaders[c] || "").trim().toUpperCase() === "STATUS") {
          statusColIndex = c;
          break;
        }
      }

      var updated = false;
      var skippedReason = false;
      var skippedStatus = false;
      var upperTicket = updateTicket.trim().toUpperCase();

      function tryUpdateRow(rowIndex) {
        // Check if reason column already has HUMAN ERROR or FORCE CANCEL
        var existingReason = String(updateData[rowIndex][reasonColIndex] || "").trim().toUpperCase();
        if (existingReason === "HUMAN ERROR" || existingReason === "FORCE CANCEL") {
          skippedReason = true;
          Logger.log("⏭️ [POST] Skipped ticket " + updateTicket + " row " + (rowIndex + 1) + " — reason already set: " + existingReason);
          return false;
        }

        // Check if status is APPROVED
        if (statusColIndex !== -1) {
          var rowStatus = String(updateData[rowIndex][statusColIndex] || "").trim().toUpperCase();
          if (rowStatus.indexOf("APPROVED") !== -1) {
            skippedStatus = true;
            Logger.log("⏭️ [POST] Skipped ticket " + updateTicket + " row " + (rowIndex + 1) + " — status is APPROVED");
            return false;
          }
        }

        targetSheet.getRange(rowIndex + 1, reasonColIndex + 1).setValue(updateReason);
        Logger.log("✅ [POST] Updated reason for ticket " + updateTicket + " in " + updateSheetName + " row " + (rowIndex + 1));
        return true;
      }

      // First try matching by TICKET NUMBER
      for (var i = 1; i < updateData.length; i++) {
        var rowTicket = String(updateData[i][ticketColIndex] || "").trim().toUpperCase();
        if (rowTicket === upperTicket) {
          updated = tryUpdateRow(i);
          break;
        }
      }
      // If not found (and not skipped), try matching by REFERENCE CODE
      if (!updated && !skippedReason && !skippedStatus && refColIndex !== -1) {
        for (var i = 1; i < updateData.length; i++) {
          var rowRef = String(updateData[i][refColIndex] || "").trim().toUpperCase();
          if (rowRef === upperTicket) {
            updated = tryUpdateRow(i);
            break;
          }
        }
      }

      if (updated) {
        return ContentService.createTextOutput("✅ Reason updated for ticket: " + updateTicket);
      } else if (skippedReason) {
        return ContentService.createTextOutput("⏭️ Reason already set for ticket: " + updateTicket);
      } else if (skippedStatus) {
        return ContentService.createTextOutput("⏭️ Status is APPROVED for ticket: " + updateTicket);
      } else {
        return ContentService.createTextOutput("⚠️ Ticket not found in sheet: " + updateTicket);
      }
    }

    // ------------------------
    // APPROVAL / DENIED
    // ------------------------
    var status = data.status || "";
    var rawCancelledBy = (data.cancelled_by || "").trim();
    
    // Extract reason from multiple possible key names for robustness
    var reasonDenied = data.reason_denied_ticket || 
                       data.reason_denied || 
                       data.reason || 
                       data.reasonDenied || 
                       data.reasonDeniedTicket || 
                       "";

    var nameMatch = rawCancelledBy.match(/^(.*?)\s+has\s+(approved|denied)/i);
    var approverName = nameMatch ? nameMatch[1].trim() : rawCancelledBy;
    var cancelled_by = CANCELLED_BY_MAP[approverName] || approverName;

    var sheet = ss.getSheetByName(area);
    if (!sheet) {
      sheet = ss.insertSheet(area);
    }
    // Always ensure headers exist (handles old sheets missing column H)
    ensureHeaders(sheet);

    sheet.appendRow([
      new Date(date),
      ticket,
      refcode,
      boothUpper,
      status,
      cancelled_by,
      area,
      reasonDenied,
      "NO",
    ]);

    Logger.log("🟩 Saved APPROVAL row → " + area + " — reasonDenied: " + reasonDenied);
    return ContentService.createTextOutput("✅ APPROVAL logged");
  } catch (err) {
    Logger.log("❌ Error in doPost: " + err);
    return ContentService.createTextOutput("❌ Error: " + err);
  }
}

// ------------------------------
// AUTO SYNC WITH BATCH + RETRY + DUPLICATE CHECK
// ------------------------------
function sendUnsyncedRowsPOSTBatchRetry(retryFailed = true) {
  const HEADER_MAP = {
    DATE: "date",
    "TICKET NUMBER": "ticket",
    "REFERENCE CODE": "refcode",
    "BOOTH CODE": "booth",
    STATUS: "status",
    "CANCELLED BY": "cancelled_by",
    AREA: "area",
    "REASON FOR DENIED TICKET": "reason_denied_ticket",
  };

  const BATCH_SIZE = 50;
  const MAX_RETRIES = 5;
  const INITIAL_DELAY = 3000;

  const spreadsheet = SpreadsheetApp.openById(ssId);
  const allowedSheets = ["CDO", "MISOR"];

  allowedSheets.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;

    ensureHeaders(sheet);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    let sentIndex = headers.indexOf("SENT");
    if (sentIndex === -1) {
      sentIndex = headers.length;
      sheet.getRange(1, sentIndex + 1).setValue("SENT");
      headers.push("SENT");
    }

    let unsyncedRows = [];
    for (let i = 1; i < data.length; i++) {
      const sentValue = String(data[i][sentIndex] || "").toUpperCase();
      if (!retryFailed && sentValue === "YES") continue;

      if (sentValue === "NO" || sentValue !== "YES") {
        const rowPayload = {};
        headers.forEach((header, j) => {
          if (HEADER_MAP[header])
            rowPayload[HEADER_MAP[header]] = String(data[i][j] || "");
        });
        if (rowPayload.date) rowPayload.date = formatForMySQL(rowPayload.date);

        unsyncedRows.push({ rowNum: i + 1, payload: rowPayload, attempts: 0 });
      }
    }

    while (unsyncedRows.length > 0) {
      const batchRows = unsyncedRows.splice(0, BATCH_SIZE);
      const payloadArray = batchRows.map((r) => r.payload);
      const rowIndexes = batchRows.map((r) => r.rowNum);

      try {
        const response = UrlFetchApp.fetch(LARAVEL_API_URL, {
          method: "post",
          contentType: "application/json",
          headers: {
            "X-SHEET-TOKEN": SHEET_API_TOKEN,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            Accept: "application/json",
          },
          payload: JSON.stringify({ rows: payloadArray }),
          muteHttpExceptions: true,
        });

        const result = JSON.parse(response.getContentText());

        result.rows.forEach((r, idx) => {
          const rowNum = rowIndexes[idx];
          const attempts = batchRows[idx].attempts;

          if (r.success && !r.already_exists) {
            if (attempts > 0) {
              sheet
                .getRange(rowNum, sentIndex + 1)
                .setValue("YES")
                .setBackground("yellow");
            } else {
              sheet
                .getRange(rowNum, sentIndex + 1)
                .setValue("YES")
                .setBackground("lightgreen");
            }
          } else if (r.success && r.already_exists) {
            sheet
              .getRange(rowNum, sentIndex + 1)
              .setValue("DUPLICATE")
              .setBackground("orange");
          } else {
            batchRows[idx].attempts++;
            if (batchRows[idx].attempts < MAX_RETRIES) {
              unsyncedRows.push(batchRows[idx]);
            } else {
              sheet
                .getRange(rowNum, sentIndex + 1)
                .setValue("NO")
                .setBackground("red");
              Logger.log(
                "❌ Row " + rowNum + " failed after max retries: " + r.error,
              );
            }
          }
        });
      } catch (err) {
        batchRows.forEach((r) => {
          r.attempts++;
          if (r.attempts < MAX_RETRIES) unsyncedRows.push(r);
          else
            sheet
              .getRange(r.rowNum, sentIndex + 1)
              .setValue("NO")
              .setBackground("red");
        });
        Logger.log("❌ Error sending batch in " + sheetName + ": " + err);
      }

      Utilities.sleep(INITIAL_DELAY);
    }
  });
}

// ------------------------
// Ensure Header Row Exists (Area sheets — 9 columns including REASON)
// ------------------------
function ensureHeaders(sheet) {
  var headers = [
    "DATE",
    "TICKET NUMBER",
    "REFERENCE CODE",
    "BOOTH CODE",
    "STATUS",
    "CANCELLED BY",
    "AREA",
    "REASON FOR DENIED TICKET",
    "SENT",
  ];

  var existingRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var existingJoined = existingRow.join("").replace(/\s+/g, "");
  var headersJoined = headers.join("").replace(/\s+/g, "");

  // Only overwrite if headers don't match (prevents data loss)
  if (existingJoined !== headersJoined) {
    // If sheet has fewer columns, expand it first
    if (existingRow.length < headers.length) {
      sheet.getRange(1, existingRow.length + 1, 1, headers.length - existingRow.length)
           .setValues([headers.slice(existingRow.length)]);
    }
    // Set only the header cells that need updating
    for (var i = 0; i < headers.length; i++) {
      if (String(existingRow[i] || "").trim() !== headers[i]) {
        sheet.getRange(1, i + 1).setValue(headers[i]);
      }
    }
  }
}

function ensureRequestHeaders(sheet) {
  var headers = [
    "DATE",
    "TICKET NUMBER",
    "REFERENCE CODE",
    "BOOTH CODE",
    "AREA",
    "SENT",
  ];

  var existingRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var existingJoined = existingRow.join("").replace(/\s+/g, "");
  var headersJoined = headers.join("").replace(/\s+/g, "");

  if (existingJoined !== headersJoined) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

// ------------------------
// GET — Fetch sheet data OR update a ticket's reason
// ------------------------
function doGet(e) {
  try {
    // --- UPDATE_REASON via GET (query params) ---
    var queryType = (e.parameter.type || "").toUpperCase();
    if (queryType === "UPDATE_REASON") {
      var getSheetName = e.parameter.area || "";
      var getTicket = e.parameter.ticket || "";
      var getReason = e.parameter.reason_denied_ticket || e.parameter.reason || "";

      if (!getSheetName || !getTicket || !getReason) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: "Missing area, ticket, or reason" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var getSs = SpreadsheetApp.openById(ssId);
      var getTargetSheet = getSs.getSheetByName(getSheetName);

      if (!getTargetSheet) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: "Sheet not found: " + getSheetName }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      ensureHeaders(getTargetSheet);
      var getData = getTargetSheet.getDataRange().getValues();
      var getHeaders = getData[0];

      // Find REASON FOR DENIED TICKET column
      var gReasonColIndex = -1;
      for (var gc = 0; gc < getHeaders.length; gc++) {
        if (String(getHeaders[gc] || "").trim().toUpperCase() === "REASON FOR DENIED TICKET") {
          gReasonColIndex = gc;
          break;
        }
      }

      if (gReasonColIndex === -1) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: "REASON FOR DENIED TICKET column not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Find TICKET NUMBER column
      var gTicketColIndex = -1;
      for (var gc = 0; gc < getHeaders.length; gc++) {
        if (String(getHeaders[gc] || "").trim().toUpperCase() === "TICKET NUMBER") {
          gTicketColIndex = gc;
          break;
        }
      }

      if (gTicketColIndex === -1) {
        return ContentService
          .createTextOutput(JSON.stringify({ error: "TICKET NUMBER column not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Find REFERENCE CODE column (for fallback matching)
      var gRefColIndex = -1;
      for (var gc = 0; gc < getHeaders.length; gc++) {
        var gRefHeader = String(getHeaders[gc] || "").trim().toUpperCase();
        if (gRefHeader === "REFERENCE CODE") {
          gRefColIndex = gc;
          break;
        }
      }

      // Find STATUS column (column E) for validation
      var gStatusColIndex = -1;
      for (var gc = 0; gc < getHeaders.length; gc++) {
        if (String(getHeaders[gc] || "").trim().toUpperCase() === "STATUS") {
          gStatusColIndex = gc;
          break;
        }
      }

      var gUpdated = false;
      var gSkippedReason = false;
      var gSkippedStatus = false;
      var gUpperTicket = getTicket.trim().toUpperCase();

      function gTryUpdateRow(rowIndex) {
        // Check if reason column already has HUMAN ERROR or FORCE CANCEL
        var existingReason = String(getData[rowIndex][gReasonColIndex] || "").trim().toUpperCase();
        if (existingReason === "HUMAN ERROR" || existingReason === "FORCE CANCEL") {
          gSkippedReason = true;
          Logger.log("⏭️ [GET] Skipped ticket " + getTicket + " row " + (rowIndex + 1) + " — reason already set: " + existingReason);
          return false;
        }

        // Check if status is APPROVED (if we can find the status column)
        if (gStatusColIndex !== -1) {
          var rowStatus = String(getData[rowIndex][gStatusColIndex] || "").trim().toUpperCase();
          if (rowStatus.indexOf("APPROVED") !== -1) {
            gSkippedStatus = true;
            Logger.log("⏭️ [GET] Skipped ticket " + getTicket + " row " + (rowIndex + 1) + " — status is APPROVED");
            return false;
          }
        }

        getTargetSheet.getRange(rowIndex + 1, gReasonColIndex + 1).setValue(getReason);
        Logger.log("✅ [GET] Updated reason for ticket " + getTicket + " in " + getSheetName + " row " + (rowIndex + 1));
        return true;
      }

      // First try matching by TICKET NUMBER
      for (var gi = 1; gi < getData.length; gi++) {
        var gRowTicket = String(getData[gi][gTicketColIndex] || "").trim().toUpperCase();
        if (gRowTicket === gUpperTicket) {
          gUpdated = gTryUpdateRow(gi);
          break;
        }
      }
      // If not found, try matching by REFERENCE CODE
      if (!gUpdated && !gSkippedReason && !gSkippedStatus && gRefColIndex !== -1) {
        for (var gi = 1; gi < getData.length; gi++) {
          var gRowRef = String(getData[gi][gRefColIndex] || "").trim().toUpperCase();
          if (gRowRef === gUpperTicket) {
            gUpdated = gTryUpdateRow(gi);
            break;
          }
        }
      }

      var gResult = { success: gUpdated, ticket: getTicket, area: getSheetName, skipped_reason_already_set: gSkippedReason, skipped_approved_status: gSkippedStatus };
      return ContentService
        .createTextOutput(JSON.stringify(gResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- Default: Fetch sheet data ---
    var spreadsheet = SpreadsheetApp.openById(ssId);
    var allowedSheets = ["CDO", "MISOR"];
    var result = {};

    allowedSheets.forEach(function (sheetName) {
      var sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        result[sheetName] = [];
        return;
      }

      ensureHeaders(sheet);

      var values = sheet.getDataRange().getValues();
      if (values.length < 2) {
        result[sheetName] = [];
        return;
      }

      var headers = values[0].map(function (header) {
        return String(header || "").trim();
      });

      var rows = [];

      for (var i = 1; i < values.length; i++) {
        var row = {};

        headers.forEach(function (header, index) {
          if (header === "SENT") return;

          var value = values[i][index];

          if (header === "DATE" && value) {
            row[header] = formatForMySQL(value);
          } else {
            row[header] = String(value || "");
          }
        });

        rows.push(row);
      }

      result[sheetName] = rows;
    });

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------
// Manual trigger to fix existing sheets — adds missing columns
// ------------------------
function fixExistingSheetHeaders() {
  var ss = SpreadsheetApp.openById(ssId);
  var sheetNames = ["CDO", "MISOR", "CDO REQUEST", "MISOR REQUEST"];
  
  sheetNames.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    
    Logger.log("🔧 Fixing headers for: " + name);
    
    if (name.indexOf("REQUEST") !== -1) {
      ensureRequestHeaders(sheet);
    } else {
      ensureHeaders(sheet);
    }
  });
  
  Logger.log("✅ All sheets updated");
}