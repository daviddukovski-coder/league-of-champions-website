/**
 * League of Champions Tour – Ranking Sync
 *
 * Deploy this as its OWN Google Apps Script Web App, bound to the Ranking
 * spreadsheet ("DO NOT TOUCH! LoC Ranking - Website") — separate from the
 * registrations Code.gs, since it's bound to a different sheet.
 *
 * Writes points into the raw entry columns of a ranking tab (Club1 | Club2 |
 * Player name | <one column per tournament> for player sheets; Club name |
 * <one column per tournament> for club sheets). A separate action reads back
 * the sheet's own "DO NOT TOUCH — WILL UPDATE AUTOMATICALLY" mirror section
 * (same columns, sorted by total points, plus a Points/Total and a Ranking
 * column) so the caller can push a fresh snapshot to the website — this
 * script never WRITES to that side, only reads it. The read is a separate
 * action (not bundled into the write's response) on purpose: a write already
 * does many individual setValue() calls, and up to four of these run
 * concurrently (one per sheet) from the site's sync button — adding a
 * flush() + several range reads on top of that pushed some real syncs past
 * the request's time budget ("Failed to fetch"). A second, read-only
 * request has nothing to wait on but the sheet's own (already-committed)
 * recalculation, so it stays fast even under that same concurrency.
 *
 * Trust model matches the registrations Code.gs: no server-side identity
 * check on who calls this endpoint. Fine for a small, single-operator site;
 * add a shared-secret check first if that stops being an acceptable risk.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'syncRanking') return jsonOut_(syncRanking_(body));
    if (body.action === 'getRankingMirror') return jsonOut_(getRankingMirror_(body));
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ranking sheets have a two-row header on player tabs (title row, then the
// real column labels) but a one-row header on club tabs — detect whichever
// row actually contains "Player name" rather than assuming a fixed row.
function findHeaderRow_(sheet) {
  var maxScan = Math.min(sheet.getLastRow(), 5);
  for (var r = 1; r <= maxScan; r++) {
    var row = sheet.getRange(r, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (row.indexOf('Player name') !== -1) return r;
  }
  return 1;
}

// body: {
//   sheetName: 'Mens ranking 2026',        // exact tab name
//   tournamentColumn: 'Matosinhos 1000',   // must already exist as a header
//   entries: [
//     { name, club1, club2, points },      // player sheets
//     { name, points }                     // club sheets (no club1/club2)
//   ]
// }
function syncRanking_(body) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.sheetName);
  if (!sheet) return { error: 'Sheet tab not found: ' + body.sheetName };

  var headerRow = findHeaderRow_(sheet);
  var header = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Both "Player name" and the tournament name appear twice on player sheets
  // (raw entry section, then the auto-sorted mirror section) — indexOf finds
  // the FIRST occurrence, which is exactly the raw section we want to write.
  var isPlayerSheet = header.indexOf('Player name') !== -1;
  var nameCol = isPlayerSheet ? (header.indexOf('Player name') + 1) : 1;
  var club1Col = isPlayerSheet ? 1 : null;
  var club2Col = isPlayerSheet ? 2 : null;

  var tournamentCol = header.indexOf(body.tournamentColumn) + 1;
  if (tournamentCol === 0) {
    return { error: 'Tournament column "' + body.tournamentColumn + '" not found in ' + body.sheetName + '. Add it to the header row first.' };
  }

  var lastRow = Math.max(sheet.getLastRow(), headerRow);
  var existingNames = lastRow > headerRow
    ? sheet.getRange(headerRow + 1, nameCol, lastRow - headerRow, 1).getValues().map(function(r) { return String(r[0]).trim().toLowerCase(); })
    : [];

  var results = [];
  body.entries.forEach(function(entry) {
    var key = String(entry.name).trim().toLowerCase();
    var idx = existingNames.indexOf(key);
    var rowIndex;
    if (idx !== -1) {
      rowIndex = headerRow + 1 + idx;
    } else {
      rowIndex = lastRow + 1;
      lastRow = rowIndex;
      existingNames.push(key);
      sheet.getRange(rowIndex, nameCol).setValue(entry.name);
    }
    if (isPlayerSheet) {
      if (entry.club1) sheet.getRange(rowIndex, club1Col).setValue(entry.club1);
      if (entry.club2) sheet.getRange(rowIndex, club2Col).setValue(entry.club2);
    }
    sheet.getRange(rowIndex, tournamentCol).setValue(entry.points);
    results.push({ name: entry.name, row: rowIndex, points: entry.points });
  });

  return { ok: true, sheet: body.sheetName, updated: results.length, results: results };
}

// body: { sheetName: 'Mens ranking 2026' } — read-only, call after
// syncRanking_ has already returned (so the sheet's formulas have already
// recomputed on its own; no flush() needed for a request that isn't also
// writing).
function getRankingMirror_(body) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.sheetName);
  if (!sheet) return { error: 'Sheet tab not found: ' + body.sheetName };

  var headerRow = findHeaderRow_(sheet);
  var header = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  var isPlayerSheet = header.indexOf('Player name') !== -1;
  var nameCol = isPlayerSheet ? (header.indexOf('Player name') + 1) : 1;

  return { ok: true, sheet: body.sheetName, mirror: readMirror_(sheet, headerRow, header, isPlayerSheet, nameCol) };
}

// The mirror section is a column-for-column copy of the raw section (same
// tournament headers, repeated) plus a trailing Points/Total column and a
// Ranking column — so its position is found from the raw section's own
// layout rather than hardcoded, and survives new tournament columns being
// added over time. Returns null if a sheet doesn't have a mirror section
// (no "Ranking" header found) instead of guessing.
function readMirror_(sheet, headerRow, header, isPlayerSheet, nameCol) {
  var firstTourCol = isPlayerSheet ? nameCol + 1 : nameCol + 2;
  var firstTourName = header[firstTourCol - 1];
  var mirrorFirstTourCol = header.lastIndexOf(firstTourName) + 1;
  var rankingCol = header.indexOf('Ranking') + 1;
  if (!firstTourName || mirrorFirstTourCol === firstTourCol || rankingCol === 0) return null;

  var mirrorNameCol = isPlayerSheet ? mirrorFirstTourCol - 1 : mirrorFirstTourCol - 2;
  var mirrorClub1Col = isPlayerSheet ? mirrorNameCol - 2 : null;
  var mirrorClub2Col = isPlayerSheet ? mirrorNameCol - 1 : null;
  var mirrorPointsCol = rankingCol - 1;

  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return [];
  var numRows = lastRow - headerRow;
  var names = sheet.getRange(headerRow + 1, mirrorNameCol, numRows, 1).getValues();
  var points = sheet.getRange(headerRow + 1, mirrorPointsCol, numRows, 1).getValues();
  var ranks = sheet.getRange(headerRow + 1, rankingCol, numRows, 1).getValues();
  var clubs1 = isPlayerSheet ? sheet.getRange(headerRow + 1, mirrorClub1Col, numRows, 1).getValues() : null;
  var clubs2 = isPlayerSheet ? sheet.getRange(headerRow + 1, mirrorClub2Col, numRows, 1).getValues() : null;

  var out = [];
  for (var i = 0; i < numRows; i++) {
    var name = names[i][0];
    if (!name) continue;
    var row = { rank: ranks[i][0] || null, name: String(name), points: points[i][0] || 0 };
    if (isPlayerSheet) {
      row.club1 = clubs1[i][0] || null;
      row.club2 = clubs2[i][0] || null;
    }
    out.push(row);
  }
  return out;
}
