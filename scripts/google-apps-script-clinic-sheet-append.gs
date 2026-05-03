/**
 * Google Apps Script — append patient schedule requests to a Sheet (CRM log).
 *
 * Setup:
 * 1. Extensions → Apps Script → paste this file (or merge doPost + helpers).
 * 2. Project Settings → Script properties:
 *    - SKINFIT_SECRET = same value as CLINIC_SHEET_WEBHOOK_SECRET (required)
 *    - SKINFIT_SHEET_NAME = tab name with CRM headers (optional; defaults to SHEET_NAME in Code.gs)
 *    - SKINFIT_SPREADSHEET_ID = spreadsheet id (required if this script is NOT “bound” to the sheet)
 *      From URL: https://docs.google.com/spreadsheets/d/THIS_PART/edit
 *    - SKINFIT_DRIVE_FOLDER_ID = Google Drive folder ID from the folder URL (recommended)
 * 2b. Project Settings → check “Show appsscript.json manifest in editor” and merge oauthScopes
 *     from `scripts/appsscript.json` (Sheets + Drive + script.scriptapp + script.external_request
 *     for UrlFetch to Skinfit). Save, then run testAuthorizeDrive() once and accept ALL permissions.
 *     Re-authorize after any scope change before createCrmSheetEditTrigger() / crmPushActiveRow().
 *     (Names ending in _ are hidden from the Run menu in Apps Script.)
 * 3. Deploy → New deployment → Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone (or Anyone with Google account if you prefer)
 * 4. Copy the web app URL into CLINIC_SHEET_REQUEST_WEBHOOK_URL, e.g.
 *    https://script.google.com/macros/s/XXXX/exec?secret=YOUR_SECRET
 *    (Next.js also sends the secret header; query param is required for many Apps Script setups.)
 *
 * Sheet layout (row 1 headers — run ensureHeaderRow() once from the editor if needed):
 *   A createdAt
 *   B requestId
 *   C patientId
 *   D patientName
 *   E patientEmail
 *   F preferredDateYm (YYYY-MM-DD; same as API field preferredDateYmd)
 *   G issue
 *   H daysAffected
 *   I timePreferences
 *   J attachmentsCount
 *   K patientPhone
 *   L patientTimezone
 *   M doctorId
 *   N status
 *   O attachmentFileNamesCsv
 *   P source
 *   Q patientSchedulesUrl
 *   R appointmentSyncUrl
 *   S sheetPayloadVersion
 *   T driveImageLinks
 *   U skinfitMirrorStatus        (filled by Skinfit write-back webhook, kind skinfit_row_sync)
 *   V skinfitMirrorConfirmedIso
 *   W skinfitMirrorNotes
 *   X skinfitMirrorAt
 *   Y crmVisitAction             (CRM: confirm | cancel | decline — Apps Script pushes to Skinfit)
 *   Z crmConfirmedDateTimeIso    (CRM: required for confirm, ISO 8601)
 *   AA crmPatientMessage         (CRM: prep note for patient)
 *   AB crmCancelledReason
 *   AC crmAppointmentType        (optional: consultation | follow-up | scan-review)
 *   AD crmSyncStatus             (Apps Script: OK … or ERROR …)
 *   AE crmSyncDetail             (Apps Script: last error body / hint)
 *   AF crmSlotEndTimeHm          (CRM: same-day end HH:mm, optional)
 *   AG skinfitMirrorSlotEndHm   (Skinfit write-back)
 *   AH skinfitPatientReply      (patient “Message clinic” from app)
 *   AI skinfitPatientReplyAt    (ISO timestamp)
 *
 * Optional: respond with JSON { "ok": true, "externalRef": "sheet-row-12" } so Skinfit stores
 * the row key for confirm/cancel webhooks (see externalRef in /api/integrations/clinic-sheet/appointments).
 *
 * Write-back from Skinfit → same web app URL with CLINIC_SHEET_SYNC_WEBHOOK_URL (POST JSON
 * kind: skinfit_row_sync). Updates status + mirror columns so the sheet is not stuck on "pending".
 *
 * CRM → Skinfit without Postman: set Script properties SKINFIT_APPOINTMENT_API_URL (production
 * https://YOURDOMAIN/api/integrations/clinic-sheet/appointments) and run createCrmSheetEditTrigger()
 * once (installable onEdit). Edits to CRM columns Y–AC and AF trigger a push. Optional: time trigger on crmTickPushPending().
 */

var SHEET_NAME = 'skinnfit-test-appointments'; // default tab; override with Script property SKINFIT_SHEET_NAME

function getCrmSheetName_() {
  var p = PropertiesService.getScriptProperties().getProperty('SKINFIT_SHEET_NAME');
  if (p && String(p).trim()) return String(p).trim();
  return SHEET_NAME;
}

function doPost(e) {
  try {
    return doPostHandler_(e);
  } catch (err) {
    return jsonOut({
      ok: false,
      error: 'script_exception',
      message: err && err.message ? String(err.message) : String(err)
    });
  }
}

/**
 * Browsers open the web app URL with GET — without doGet, Google shows "doGet not found".
 * Skinfit + sheet CRM still require POST with JSON (doPost). This is only a sanity hint.
 */
function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      message:
        'Skinfit clinic sheet endpoint is live. Use HTTP POST (doPost) with JSON — e.g. kind patient_schedule_request or skinfit_row_sync. Opening this link in a browser does not run a webhook.'
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Web apps are often standalone: getActiveSpreadsheet() is null. Use bound sheet
 * OR Script Property SKINFIT_SPREADSHEET_ID (raw id or full Sheets URL).
 */
function getTargetSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  var raw = (
    PropertiesService.getScriptProperties().getProperty('SKINFIT_SPREADSHEET_ID') ||
    ''
  ).trim();
  if (!raw) {
    throw new Error(
      'Set Script Property SKINFIT_SPREADSHEET_ID to your Google Sheet id (from URL .../spreadsheets/d/ID/edit), OR create this script via Extensions → Apps Script from inside that spreadsheet.'
    );
  }
  var id = raw;
  var m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) {
    id = m[1];
  } else if (raw.indexOf('http') === 0) {
    throw new Error(
      'SKINFIT_SPREADSHEET_ID: paste the spreadsheet id only, or the full Google Sheets URL.'
    );
  }
  if (!/^[a-zA-Z0-9-_]{20,128}$/.test(id)) {
    throw new Error('SKINFIT_SPREADSHEET_ID looks invalid.');
  }
  return SpreadsheetApp.openById(id);
}

function doPostHandler_(e) {
  if (!e || !e.parameter || !e.postData) {
    return jsonOut({
      ok: false,
      error: 'manual_run_not_supported',
      hint: 'Deploy as Web app and send HTTP POST. For quick checks, run testEnsureHeaderRow() from editor.'
    }, 400);
  }

  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty('SKINFIT_SECRET') || '';
  var fromQuery = (e.parameter && e.parameter.secret) || '';
  var bodyText = e.postData && e.postData.contents ? e.postData.contents : '{}';
  if (bodyText.length > 4800000) {
    return jsonOut({
      ok: false,
      error: 'payload_too_large',
      message:
        'POST body too large for Apps Script. Send fewer/smaller images, or rely on Skinfit-only storage.'
    });
  }

  if (!expected || fromQuery !== expected) {
    return jsonOut({ ok: false, error: 'unauthorized' }, 401);
  }

  var data;
  try {
    data = JSON.parse(bodyText);
  } catch (err) {
    return jsonOut({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!data || typeof data.kind !== 'string') {
    return jsonOut({ ok: false, error: 'unexpected_kind' }, 400);
  }

  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(getCrmSheetName_()) || ss.getSheets()[0];
  ensureHeaderRowForSheet_(sheet);

  if (data.kind === 'skinfit_row_sync') {
    return handleSkinfitRowSync_(data, sheet);
  }

  if (data.kind !== 'patient_schedule_request') {
    return jsonOut({ ok: false, error: 'unexpected_kind' }, 400);
  }
  var driveCol = '';
  try {
    var driveLinks = saveImagesToDriveAndGetLinks_(data);
    driveCol = driveLinks.join(' | ');
  } catch (err) {
    driveCol =
      'DRIVE_ERROR: ' + (err && err.message ? err.message : String(err));
  }

  var row = [
    data.createdAt || '',
    data.requestId || '',
    data.patientId || '',
    data.patientName || '',
    data.patientEmail || '',
    data.preferredDateYmd || data.preferredDateYm || '',
    data.issue || '',
    data.daysAffected != null ? data.daysAffected : '',
    data.timePreferences || '',
    data.attachmentsCount != null ? data.attachmentsCount : '',
    asSheetText_(data.patientPhone || ''),
    data.patientTimezone || '',
    data.doctorId || '',
    data.status || 'pending',
    data.attachmentFileNamesCsv || '',
    data.source || '',
    data.patientSchedulesUrl || '',
    data.appointmentSyncUrl || '',
    data.sheetPayloadVersion != null ? data.sheetPayloadVersion : '',
    driveCol,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  sheet.appendRow(row);
  var lastRow = sheet.getLastRow();
  var externalRef = 'sheet-row-' + lastRow;

  return jsonOut({ ok: true, externalRef: externalRef, row: lastRow });
}

function asSheetText_(v) {
  var s = String(v == null ? '' : v);
  // Prevent Sheets interpreting +91... as formula and showing #ERROR!
  if (s && (s[0] === '+' || s[0] === '=')) return "'" + s;
  return s;
}

function saveImagesToDriveAndGetLinks_(data) {
  var items = Array.isArray(data.attachments) ? data.attachments : [];
  if (!items.length) return [];

  var folder = resolveSkinfitDriveFolder_();
  var out = [];
  var requestId = (data.requestId || 'request').toString();

  for (var i = 0; i < items.length; i++) {
    var a = items[i] || {};
    var dataUri = (a.dataUri || '').toString();
    if (!dataUri || dataUri.indexOf('data:image/') !== 0) continue;
    var mimeMatch = dataUri.match(/^data:([^;,]+)/i);
    var mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    var b64Idx = dataUri.indexOf('base64,');
    if (b64Idx === -1) continue;
    var b64 = dataUri.substring(b64Idx + 7);
    var bytes = Utilities.base64Decode(b64);
    var ext = mimeTypeToExt_(mimeType);
    var safeName = sanitizeFileName_(a.fileName || ('image-' + (i + 1) + ext));
    var fileName = requestId + '-' + safeName;
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var file = folder.createFile(blob);
    out.push(file.getUrl());
  }
  return out;
}

function sanitizeFileName_(name) {
  var s = String(name || 'image');
  s = s.replace(/[\\/:*?"<>|#%\[\]\r\n]+/g, '-').trim();
  if (!s) s = 'image';
  return s;
}

function mimeTypeToExt_(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/heic') return '.heic';
  return '.jpg';
}

function jsonOut(obj, statusCode) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  // Apps Script web apps ignore HTTP status in most cases; still return JSON body.
  return out;
}

/**
 * Run once from the Apps Script editor to write headers on row 1 (optional).
 */
function ensureHeaderRow() {
  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(getCrmSheetName_()) || ss.getSheets()[0];
  ensureHeaderRowForSheet_(sheet);
}

/**
 * Safe editor-run helper (no webhook payload needed).
 * Use this instead of running doPost() manually.
 */
function testEnsureHeaderRow() {
  ensureHeaderRow();
  Logger.log('Header row ensured for sheet: ' + getCrmSheetName_());
}

/**
 * Resolves Script Property SKINFIT_DRIVE_FOLDER_ID to a Folder.
 * Accepts raw id OR a full https://drive.google.com/.../folders/ID URL.
 * Empty property → My Drive root.
 */
function resolveSkinfitDriveFolder_() {
  var raw = (
    PropertiesService.getScriptProperties().getProperty('SKINFIT_DRIVE_FOLDER_ID') ||
    ''
  ).trim();
  if (!raw) {
    return DriveApp.getRootFolder();
  }
  var folderId = raw;
  var fromUrl = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) {
    folderId = fromUrl[1];
  } else if (raw.indexOf('http') === 0) {
    throw new Error(
      'SKINFIT_DRIVE_FOLDER_ID: use only the folder id, or a URL containing /folders/ID'
    );
  }
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(folderId)) {
    throw new Error(
      'SKINFIT_DRIVE_FOLDER_ID looks wrong after parsing (got "' +
        folderId +
        '"). Copy id from: drive.google.com/drive/folders/THIS_PART'
    );
  }
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error(
      'Cannot open Drive folder id=' +
        folderId +
        '. Fix: (1) id copied exactly, (2) the account that OWNS this script can open that folder in Drive, (3) folder is not restricted by Workspace admin. Optional: delete SKINFIT_DRIVE_FOLDER_ID to use My Drive root. Detail: ' +
        (e && e.message ? e.message : e)
    );
  }
}

/** Run once from editor to confirm Drive write access (after oauthScopes + folder id). */
function testAuthorizeDrive() {
  var folder = resolveSkinfitDriveFolder_();
  var f = folder.createFile('skinfit-auth-test.txt', 'ok', MimeType.PLAIN_TEXT);
  f.setTrashed(true);
  Logger.log('Drive OK. Folder id used: ' + folder.getId());
}

function getFullHeaderRow_() {
  return [
    'createdAt',
    'requestId',
    'patientId',
    'patientName',
    'patientEmail',
    'preferredDateYm',
    'issue',
    'daysAffected',
    'timePreferences',
    'attachmentsCount',
    'patientPhone',
    'patientTimezone',
    'doctorId',
    'status',
    'attachmentFileNamesCsv',
    'source',
    'patientSchedulesUrl',
    'appointmentSyncUrl',
    'sheetPayloadVersion',
    'driveImageLinks',
    'skinfitMirrorStatus',
    'skinfitMirrorConfirmedIso',
    'skinfitMirrorNotes',
    'skinfitMirrorAt',
    'crmVisitAction',
    'crmConfirmedDateTimeIso',
    'crmPatientMessage',
    'crmCancelledReason',
    'crmAppointmentType',
    'crmSyncStatus',
    'crmSyncDetail',
    'crmSlotEndTimeHm',
    'skinfitMirrorSlotEndHm',
    'skinfitPatientReply',
    'skinfitPatientReplyAt'
  ];
}

/**
 * @returns {Object.<string, number>} header name -> 1-based column index
 */
function buildHeaderIndexMap_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var head = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < head.length; c++) {
    var k = String(head[c] || '')
      .trim()
      .toLowerCase();
    if (k) map[k] = c + 1;
  }
  return map;
}

function padRowToWidth_(row, width) {
  var out = row.slice();
  while (out.length < width) out.push('');
  return out;
}

function ensureHeaderRowForSheet_(sheet) {
  var headers = getFullHeaderRow_();

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  var a1 = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (a1 !== 'createdAt') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  var curCols = sheet.getLastColumn();
  if (curCols < headers.length) {
    var missing = [];
    for (var i = curCols; i < headers.length; i++) {
      missing.push(headers[i]);
    }
    sheet.getRange(1, curCols + 1, 1, headers.length).setValues([missing]);
  }
}

function parseSheetRowFromExternalRef_(externalRef) {
  var s = String(externalRef || '').trim();
  var m = s.match(/^sheet-row-(\d+)$/i);
  if (!m) return null;
  var n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

function statusForSkinfitMirror_(skinfitStatus) {
  var t = String(skinfitStatus || '')
    .trim()
    .toLowerCase();
  if (t === 'confirmed') return 'confirmed';
  if (t === 'cancelled') return 'cancelled';
  if (t === 'declined') return 'declined';
  if (t === 'pending') return 'pending';
  return t || 'pending';
}

function handleSkinfitRowSync_(data, sheet) {
  ensureHeaderRowForSheet_(sheet);
  var map = buildHeaderIndexMap_(sheet);

  var rowNum = null;
  var sid =
    data.scheduleRequestId != null ? String(data.scheduleRequestId).trim() : '';
  if (
    sid &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)
  ) {
    var colReq = map['requestid'] || 2;
    var lastScan = sheet.getLastRow();
    for (var rr = 2; rr <= lastScan; rr++) {
      var cellId = String(sheet.getRange(rr, colReq).getValue() || '').trim();
      if (cellId.toLowerCase() === sid.toLowerCase()) {
        rowNum = rr;
        break;
      }
    }
  }
  if (!rowNum) {
    rowNum = parseSheetRowFromExternalRef_(data.externalRef);
  }
  if (!rowNum) {
    return jsonOut({ ok: false, error: 'bad_external_ref_or_request_id' }, 400);
  }
  if (rowNum > sheet.getLastRow()) {
    return jsonOut({ ok: false, error: 'row_out_of_range' }, 400);
  }
  var colStatus = map['status'] || 14;
  var cMirrorSt = map['skinfitmirrorstatus'] || 21;
  var cMirrorIso = map['skinfitmirrorconfirmediso'] || 22;
  var cMirrorNotes = map['skinfitmirrornotes'] || 23;
  var cMirrorAt = map['skinfitmirrorat'] || 24;

  var st = statusForSkinfitMirror_(data.skinfitStatus);
  var iso = data.confirmedIso != null ? String(data.confirmedIso) : '';
  var notes = data.notes != null ? String(data.notes) : '';
  var nowIso = new Date().toISOString();

  sheet.getRange(rowNum, colStatus).setValue(st);
  sheet
    .getRange(rowNum, cMirrorSt, rowNum, cMirrorAt)
    .setValues([[st, iso, notes, nowIso]]);

  var cMirrorEnd = map['skinfitmirrorslotendhm'] || 33;
  var cPat = map['skinfitpatientreply'] || 34;
  var cPatAt = map['skinfitpatientreplyat'] || 35;

  var endHm =
    data.confirmedSlotEndTimeHm != null &&
    String(data.confirmedSlotEndTimeHm).trim() !== ''
      ? String(data.confirmedSlotEndTimeHm).trim()
      : '';
  if (endHm) {
    sheet.getRange(rowNum, cMirrorEnd).setValue(endHm);
  }

  if (data.patientClinicNote != null) {
    sheet.getRange(rowNum, cPat).setValue(String(data.patientClinicNote));
    var patAt =
      data.patientClinicNoteAt != null && String(data.patientClinicNoteAt).trim() !== ''
        ? String(data.patientClinicNoteAt).trim()
        : nowIso;
    sheet.getRange(rowNum, cPatAt).setValue(patAt);
  }

  return jsonOut({ ok: true, row: rowNum, updated: true });
}

function getCellByHeader_(sheet, rowNum, headerMap, name, fallback1Based) {
  var col = headerMap[String(name).toLowerCase()] || fallback1Based;
  return String(sheet.getRange(rowNum, col).getValue() || '').trim();
}

/**
 * Google Sheets often stores typed times as Date (epoch day + clock).
 * Skinfit expects "HH:mm" text — String(date) breaks normalizeSlotHm.
 */
function sheetCellToHmString_(value) {
  if (value == null || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value).trim();
}

function setCellByHeader_(sheet, rowNum, headerMap, name, fallback1Based, value) {
  var col = headerMap[String(name).toLowerCase()] || fallback1Based;
  sheet.getRange(rowNum, col).setValue(value);
}

/**
 * Installable onEdit — create trigger once via createCrmSheetEditTrigger().
 * Fires when the edit overlaps CRM columns Y–AF (25–32), including row-wide pastes from col A.
 */
function onEditInstallable_(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  ensureHeaderRowForSheet_(sh);
  var map = buildHeaderIndexMap_(sh);
  if (!map['crmvisitaction']) return;

  var startCol = e.range.getColumn();
  var endCol = e.range.getLastColumn();
  var lo = 25;
  var hi = 32;
  if (endCol < lo || startCol > hi) return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    for (var r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
      if (r < 2) continue;
      maybePushRowToSkinfit_(sh, r);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run once from editor: Spreadsheet → onEdit → onEditInstallable_
 * Requires manifest oauth scope `https://www.googleapis.com/auth/script.scriptapp`
 * (see repo `scripts/appsscript.json`). After merging scopes: save manifest, then
 * Run → Review permissions → accept all, then run this again.
 */
function createCrmSheetEditTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Open the spreadsheet, then run createCrmSheetEditTrigger from its bound script.');
  }
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditInstallable_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditInstallable_')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log('Trigger created: onEdit → onEditInstallable_');
}

/**
 * Debug / fallback: select any cell on a data row (2+), then Run → crmPushActiveRow.
 * Writes crmSyncStatus / crmSyncDetail even when onEdit did not fire (e.g. bulk paste quirks).
 */
function crmPushActiveRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the spreadsheet.');
  var sh = ss.getActiveSheet();
  var r = ss.getActiveRange().getRow();
  if (r < 2) throw new Error('Select row 2 or below.');
  maybePushRowToSkinfit_(sh, r);
  Logger.log('crmPushActiveRow finished for row ' + r);
}

/** Optional: time-driven (every 5–10 min) to pick up rows if onEdit missed. */
function crmTickPushPending() {
  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(getCrmSheetName_()) || ss.getSheets()[0];
  ensureHeaderRowForSheet_(sheet);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    for (var r = 2; r <= sheet.getLastRow(); r++) {
      maybePushRowToSkinfit_(sheet, r);
    }
  } finally {
    lock.releaseLock();
  }
}

function maybePushRowToSkinfit_(sheet, rowNum) {
  ensureHeaderRowForSheet_(sheet);
  var map = buildHeaderIndexMap_(sheet);
  var action = getCellByHeader_(sheet, rowNum, map, 'crmVisitAction', 25).toLowerCase();
  if (!action || action === 'ok' || action === 'pushed') return;

  var syncSt = getCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30);
  if (syncSt.indexOf('OK') === 0) return;

  if (action !== 'confirm' && action !== 'cancel' && action !== 'decline') {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(
      sheet,
      rowNum,
      map,
      'crmSyncDetail',
      31,
      'crmVisitAction must be confirm, cancel, or decline'
    );
    return;
  }

  var patientId = getCellByHeader_(sheet, rowNum, map, 'patientId', 3);
  if (!patientId) {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(sheet, rowNum, map, 'crmSyncDetail', 31, 'missing patientId');
    return;
  }

  var externalRef = 'sheet-row-' + rowNum;
  var requestIdRaw = getCellByHeader_(sheet, rowNum, map, 'requestId', 2);
  var scheduleRequestId = null;
  if (requestIdRaw) {
    var rid = String(requestIdRaw).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rid)) {
      scheduleRequestId = rid;
    }
  }
  var iso = getCellByHeader_(sheet, rowNum, map, 'crmConfirmedDateTimeIso', 26);
  var msg = getCellByHeader_(sheet, rowNum, map, 'crmPatientMessage', 27);
  var cancelReason = getCellByHeader_(sheet, rowNum, map, 'crmCancelledReason', 28);
  var apptTypeRaw = getCellByHeader_(sheet, rowNum, map, 'crmAppointmentType', 29);
  var slotEndHm = '';
  if (map['crmslotendtimehm']) {
    var rawEnd = sheet.getRange(rowNum, map['crmslotendtimehm']).getValue();
    slotEndHm = sheetCellToHmString_(rawEnd);
  }

  if (action === 'confirm' && !iso) {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(
      sheet,
      rowNum,
      map,
      'crmSyncDetail',
      31,
      'confirm requires crmConfirmedDateTimeIso (ISO 8601)'
    );
    return;
  }

  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SKINFIT_SECRET') || '';
  var apiUrl = (props.getProperty('SKINFIT_APPOINTMENT_API_URL') || '').trim();
  if (!apiUrl) {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(
      sheet,
      rowNum,
      map,
      'crmSyncDetail',
      31,
      'Set Script property SKINFIT_APPOINTMENT_API_URL to https://YOURDOMAIN/api/integrations/clinic-sheet/appointments'
    );
    return;
  }

  var update = {
    action: action,
    patientId: patientId,
    externalRef: externalRef,
    scheduleRequestId: scheduleRequestId,
    confirmedDateTimeIso: action === 'confirm' ? iso : null,
    confirmedSlotEndTimeHm: action === 'confirm' && slotEndHm ? slotEndHm : null,
    appointmentType: apptTypeRaw || null,
    cancelledReason: cancelReason || null,
    patientMessage: msg || null
  };

  var payload = { updates: [update] };
  var res = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-skinfit-sheet-secret': secret },
    payload: JSON.stringify(payload)
  });
  var code = res.getResponseCode();
  var body = res.getContentText() || '';
  if (code < 200 || code >= 300) {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(sheet, rowNum, map, 'crmSyncDetail', 31, body.slice(0, 900));
    return;
  }
  try {
    var j = JSON.parse(body);
    if (!j || !j.success) {
      setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
      setCellByHeader_(
        sheet,
        rowNum,
        map,
        'crmSyncDetail',
        31,
        (body || 'no_success').slice(0, 900)
      );
      return;
    }
    var applied = typeof j.applied === 'number' ? j.applied : 0;
    var errs = j.errors;
    if (applied < 1) {
      var detail =
        Array.isArray(errs) && errs.length
          ? errs.join(' | ')
          : body.slice(0, 900);
      setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
      setCellByHeader_(sheet, rowNum, map, 'crmSyncDetail', 31, detail);
      return;
    }
  } catch (err) {
    setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, 'ERROR');
    setCellByHeader_(sheet, rowNum, map, 'crmSyncDetail', 31, 'invalid_json_response');
    return;
  }

  var okStamp = 'OK ' + new Date().toISOString();
  setCellByHeader_(sheet, rowNum, map, 'crmSyncStatus', 30, okStamp);
  setCellByHeader_(sheet, rowNum, map, 'crmSyncDetail', 31, '');
  setCellByHeader_(sheet, rowNum, map, 'crmVisitAction', 25, '');
}

/**
 * --- CRM → Skinfit (confirm / cancel / decline) ---
 *
 * POST the same URL as column `appointmentSyncUrl` on each row (your production
 * `https://YOURDOMAIN.com/api/integrations/clinic-sheet/appointments`), NOT localhost.
 *
 * Header: x-skinfit-sheet-secret: <same value as CLINIC_SHEET_WEBHOOK_SECRET in .env>
 *
 * Body shape: { "updates": [ { ...one object per row... } ] }
 *
 * CONFIRM (book final slot + optional patient instructions):
 * {
 *   "updates": [{
 *     "action": "confirm",
 *     "patientId": "<column C uuid>",
 *     "scheduleRequestId": "<column B requestId uuid — preferred if rows move>",
 *     "externalRef": "<sheet-row-N; used if scheduleRequestId missing>",
 *     "confirmedDateTimeIso": "2026-05-20T14:00:00+05:30",
 *     "appointmentType": "consultation",
 *     "patientMessage": "Apply the cream we discussed before you come."
 *   }]
 * }
 *
 * CANCEL or DECLINE (optional reason + optional extra note):
 * {
 *   "updates": [{
 *     "action": "cancel",
 *     "patientId": "<column C>",
 *     "externalRef": "sheet-row-5",
 *     "cancelledReason": "Doctor unavailable that afternoon.",
 *     "patientMessage": "Please rebook via the app when you can."
 *   }]
 * }
 *
 * Example Apps Script (set SKINFIT_APPOINTMENT_API_URL in Script properties to production URL):
 *
 * function sendSkinfitConfirmFromSheetRow() {
 *   var secret = PropertiesService.getScriptProperties().getProperty('SKINFIT_SECRET');
 *   var url = PropertiesService.getScriptProperties().getProperty('SKINFIT_APPOINTMENT_API_URL');
 *   var payload = {
 *     updates: [{
 *       action: 'confirm',
 *       patientId: '675fb6a2-1da3-4cc5-a898-89aaa81dfa6e',
 *       externalRef: 'sheet-row-3',
 *       confirmedDateTimeIso: '2026-05-20T14:00:00+05:30',
 *       appointmentType: 'consultation',
 *       patientMessage: 'Apply sunscreen before visit.'
 *     }]
 *   };
 *   UrlFetchApp.fetch(url, {
 *     method: 'post',
 *     contentType: 'application/json',
 *     muteHttpExceptions: true,
 *     headers: { 'x-skinfit-sheet-secret': secret },
 *     payload: JSON.stringify(payload)
 *   });
 * }
 */
