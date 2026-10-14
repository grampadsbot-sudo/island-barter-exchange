/**
 * IBE member review collector.
 *
 * Bound to the responses Google Sheet (Extensions > Apps Script).
 * Deploy as a web app: Execute as Me, access Anyone.
 * Set Script Property SURVEY_TOKEN to the shared invite secret.
 * The page posts JSON with Content-Type text/plain so the browser
 * does not send a CORS preflight. The token is checked and never
 * written to the sheet.
 */
var HEADERS = [
  'Timestamp',
  'Likelihood to recommend (0-10)',
  'Reasons for score',
  'Sense of community',
  'Quality of members',
  "Members' passion for their businesses",
  'Member listings, photos & business summaries',
  'Ease of connecting with other members',
  'Enjoy most',
  'Add or improve',
  'Name',
  'Business name',
  'Business owner referral',
  'Local charity',
  'May share positive comments'
];

function doGet() {
  return json_({ ok: false, error: 'post_only' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var data = parseBody_(e);
    if (!data) return json_({ ok: false, error: 'invalid' });
    if (!authorized_(data.token)) return json_({ ok: false, error: 'unauthorized' });

    var row = buildRow_(data);
    if (!row) return json_({ ok: false, error: 'invalid' });

    locked = lock.tryLock(15000);
    if (!locked) return json_({ ok: false, error: 'busy' });

    var sheet = getResponseSheet_();
    sheet.appendRow(row);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'save_failed' });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function authorized_(token) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('SURVEY_TOKEN') || '').trim();
  token = String(token || '').trim();
  var digest = function (value) {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(value),
      Utilities.Charset.UTF_8
    );
    return bytes;
  };
  var a = digest(expected);
  var b = digest(token || '');
  var mismatch = expected ? 0 : 1;
  for (var i = 0; i < a.length; i++) mismatch |= (a[i] & 255) ^ (b[i] & 255);
  return mismatch === 0;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  var raw = e.postData.contents;
  if (raw.length > 50000) return null;
  try {
    var data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    return null;
  }
}

function buildRow_(data) {
  var recommend = intIn_(data.recommend, 0, 10);
  var community = intIn_(data.community, 1, 5);
  var memberQuality = intIn_(data.memberQuality, 1, 5);
  var passion = intIn_(data.passion, 1, 5);
  var listings = intIn_(data.listings, 1, 5);
  var connecting = intIn_(data.connecting, 1, 5);
  var reasons = cell_(data.reasons, 2000);
  if (recommend === null || community === null || memberQuality === null || passion === null || listings === null || connecting === null) {
    return null;
  }
  if (!reasons) return null;

  return [
    new Date(),
    recommend,
    reasons,
    community,
    memberQuality,
    passion,
    listings,
    connecting,
    cell_(data.enjoy, 2000),
    cell_(data.improve, 2000),
    cell_(data.name, 200),
    cell_(data.business, 200),
    cell_(data.referral, 2000),
    cell_(data.charity, 2000),
    truthy_(data.shareComments) ? 'Yes' : 'No'
  ];
}

function intIn_(value, min, max) {
  if (typeof value === 'boolean' || value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  var n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!isFinite(n) || Math.floor(n) !== n) return null;
  if (n < min || n > max) return null;
  return n;
}

function cell_(value, maxLen) {
  var s = value == null ? '' : String(value);
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return s;
}

function truthy_(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'Yes';
}

function getResponseSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Responses');
  if (!sheet) sheet = ss.insertSheet('Responses');
  var needsHeader = sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== 'Timestamp';
  if (needsHeader) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    } else {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
