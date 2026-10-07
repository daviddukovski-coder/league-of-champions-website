/**
 * Affen-Abenteuer – Speicher im Google Sheet
 *
 * Dieses Skript gehört zu einem Google Sheet (Erweiterungen → Apps Script).
 * Es zeigt die App an (Datei "Index") und speichert pro Kind den Spielstand.
 *
 * Tabellenblätter (werden automatisch angelegt):
 *   Kinder       – Spalte A: Namen der Kinder (hier oder in der App eintragen)
 *   Fortschritt  – Name | Spielstand (JSON) | Bananen | Level geschafft | Zuletzt gespielt
 */

const TEACHER_CODE = '56';   // muss zu CONFIG.TEACHER_CODE in der App passen (7 · 8)
const SHEET_KIDS = 'Kinder';
const SHEET_PROGRESS = 'Fortschritt';

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action) {
    let args = [];
    try { args = JSON.parse(e.parameter.args || '[]'); } catch (err) {}
    return json_(api(action, args));
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Affen-Abenteuer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return json_(api(body.action, body.args || []));
}

// Einstiegspunkt für die App (google.script.run.api) und für doGet/doPost
function api(action, args) {
  const fns = { apiKids: apiKids_, apiLoad: apiLoad_, apiSave: apiSave_, apiAddKid: apiAddKid_, apiRemoveKid: apiRemoveKid_ };
  try {
    if (!fns[action]) throw new Error('Unbekannte Aktion');
    return { ok: true, data: fns[action].apply(null, args || []) };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}

function cleanName_(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

function apiKids_() {
  const sh = sheet_(SHEET_KIDS, ['Name']);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 1).getValues().map(r => cleanName_(r[0])).filter(Boolean);
}

function findRow_(sh, name) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const key = cleanName_(name).toLowerCase();
  const names = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < names.length; i++) if (cleanName_(names[i][0]).toLowerCase() === key) return i + 2;
  return -1;
}

function apiLoad_(name) {
  const sh = sheet_(SHEET_PROGRESS, ['Name', 'Spielstand', 'Bananen', 'Level geschafft', 'Zuletzt gespielt']);
  const row = findRow_(sh, name);
  return row < 0 ? null : String(sh.getRange(row, 2).getValue() || '') || null;
}

function apiSave_(name, data, bananas, levels) {
  name = cleanName_(name);
  if (!name) throw new Error('Kein Name');
  if (findRow_(sheet_(SHEET_KIDS, ['Name']), name) < 0) throw new Error('Name ist nicht in der Kinder-Liste');
  const json = String(data || '');
  if (json.length > 20000) throw new Error('Spielstand zu groß');
  JSON.parse(json);   // nur gültige Spielstände speichern
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(SHEET_PROGRESS, ['Name', 'Spielstand', 'Bananen', 'Level geschafft', 'Zuletzt gespielt']);
    const values = [[name, json, Number(bananas) || 0, Number(levels) || 0, new Date()]];
    const row = findRow_(sh, name);
    if (row < 0) sh.appendRow(values[0]); else sh.getRange(row, 1, 1, 5).setValues(values);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function apiAddKid_(name, code) {
  if (String(code) !== TEACHER_CODE) throw new Error('Falscher Lehrkraft-Code');
  name = cleanName_(name);
  if (!name) throw new Error('Kein Name');
  const sh = sheet_(SHEET_KIDS, ['Name']);
  if (findRow_(sh, name) < 0) sh.appendRow([name]);
  return apiKids_();
}

function apiRemoveKid_(name, code) {
  if (String(code) !== TEACHER_CODE) throw new Error('Falscher Lehrkraft-Code');
  const sh = sheet_(SHEET_KIDS, ['Name']);
  const row = findRow_(sh, name);
  if (row > 0) sh.deleteRow(row);   // der Spielstand im Blatt "Fortschritt" bleibt erhalten
  return apiKids_();
}
