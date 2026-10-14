/**
 * IBE member review collector.
 *
 * Bound to the responses Google Sheet (Extensions > Apps Script).
 * Deploy as a web app: Execute as Me, access Anyone.
 *
 * Kim types Name, Business, and Phone on the Members tab, then uses
 * IBE Survey > Generate links. Each member gets their own token and link.
 * There is no shared SURVEY_TOKEN.
 *
 * doGet only checks that ?t= matches a Members row. It returns ok,
 * used, or unknown, and never returns a name, business, phone, or any
 * other member detail. A Submitted row is single-use. doPost writes
 * that member's answers once. Another post is rejected and logged.
 * The page posts JSON as text/plain so the browser skips the CORS preflight.
 */
var LINK_PREFIX = 'https://islandbarterexchange.com/member-review?t=';

var MEMBER_HEADERS = [
  'Name',
  'Business',
  'Phone',
  'Token',
  'Link',
  'Status',
  'Submitted At',
  'Likelihood to recommend (0-10)',
  'Reasons for score',
  'Sense of community',
  'Quality of members',
  "Members' passion for their businesses",
  'Member listings, photos & business summaries',
  'Ease of connecting with other members',
  'Enjoy most',
  'Add or improve',
  'Business owner referral',
  'Local charity',
  'May share positive comments'
];

var LOG_HEADERS = [
  'Timestamp',
  'Result',
  'Name',
  'Business',
  'Phone',
  'Token',
  'Likelihood to recommend (0-10)',
  'Reasons for score',
  'Sense of community',
  'Quality of members',
  "Members' passion for their businesses",
  'Member listings, photos & business summaries',
  'Ease of connecting with other members',
  'Enjoy most',
  'Add or improve',
  'Business owner referral',
  'Local charity',
  'May share positive comments'
];

var COL = {
  name: 1,
  business: 2,
  phone: 3,
  token: 4,
  link: 5,
  status: 6,
  submittedAt: 7,
  answers: 8
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IBE Survey')
    .addItem('Generate links', 'generateLinks')
    .addToUi();
}

function generateLinks() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getMembersSheet_();
    var last = sheet.getLastRow();
    if (last < 2) {
      SpreadsheetApp.getUi().alert(
        'Add members on the Members tab first. Type Name, Business, and Phone starting in row 2, then choose IBE Survey > Generate links again.'
      );
      return;
    }
    var values = sheet.getRange(2, 1, last - 1, MEMBER_HEADERS.length).getValues();
    var used = {};
    var r;
    for (r = 0; r < values.length; r++) {
      var known = String(values[r][COL.token - 1] || '').trim();
      if (known) used[known] = true;
    }
    var created = 0;
    var linksFilled = 0;
    for (r = 0; r < values.length; r++) {
      var name = String(values[r][COL.name - 1] || '').trim();
      var business = String(values[r][COL.business - 1] || '').trim();
      var phone = String(values[r][COL.phone - 1] || '').trim();
      if (!name && !business && !phone) continue;
      var token = String(values[r][COL.token - 1] || '').trim();
      var link = String(values[r][COL.link - 1] || '').trim();
      var rowNum = r + 2;
      if (!token) {
        token = newToken_(used);
        used[token] = true;
        sheet.getRange(rowNum, COL.token).setValue(token);
        sheet.getRange(rowNum, COL.link).setValue(linkFor_(token));
        created++;
      } else if (!link) {
        sheet.getRange(rowNum, COL.link).setValue(linkFor_(token));
        linksFilled++;
      }
    }
    var message = 'Generated ' + created + ' new link' + (created === 1 ? '' : 's') + '. Existing tokens were left as they are.';
    if (linksFilled) {
      message += ' Filled ' + linksFilled + ' missing link' + (linksFilled === 1 ? '' : 's') + ' from the token already on that row.';
    }
    message += ' Text each member the Link in their row.';
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {
    SpreadsheetApp.getUi().alert('Could not generate links. Save the script, reload the sheet, and try again.');
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var token = '';
    if (e && e.parameter && e.parameter.t != null) token = String(e.parameter.t).trim();
    if (!token) return json_({ ok: false, error: 'unknown' });
    var found = findMemberByToken_(token);
    if (!found) return json_({ ok: false, error: 'unknown' });
    if (isSubmitted_(found.status)) return json_({ ok: false, error: 'used' });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'unavailable' });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var data = parseBody_(e);
    if (!data) return json_({ ok: false, error: 'invalid' });

    locked = lock.tryLock(15000);
    if (!locked) return json_({ ok: false, error: 'busy' });

    var found = findMemberByToken_(data.token);
    if (!found) return json_({ ok: false, error: 'unknown' });

    var answers = answersFrom_(data);
    if (isSubmitted_(found.status)) {
      appendLog_(found, answers || blankAnswers_(), 'rejected-duplicate');
      return json_({ ok: false, error: 'used' });
    }
    if (!answers) return json_({ ok: false, error: 'invalid' });

    var sheet = found.sheet;
    var row = found.row;
    var submittedAt = new Date();
    sheet.getRange(row, COL.answers, 1, answers.length).setValues([answers]);
    sheet.getRange(row, COL.status).setValue('Submitted');
    sheet.getRange(row, COL.submittedAt).setValue(submittedAt);
    sheet.getRange(row, COL.submittedAt).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    appendLog_(found, answers, 'accepted', submittedAt);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'save_failed' });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function blankAnswers_() {
  var blank = [];
  for (var i = 0; i < 12; i++) blank.push('');
  return blank;
}

function answersFrom_(data) {
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
    recommend,
    reasons,
    community,
    memberQuality,
    passion,
    listings,
    connecting,
    cell_(data.enjoy, 2000),
    cell_(data.improve, 2000),
    cell_(data.referral, 2000),
    cell_(data.charity, 2000),
    truthy_(data.shareComments) ? 'Yes' : 'No'
  ];
}

function findMemberByToken_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var sheet = getMembersSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, 1, last - 1, COL.status).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][COL.token - 1] || '').trim() === token) {
      return {
        sheet: sheet,
        row: i + 2,
        name: String(values[i][COL.name - 1] || ''),
        business: String(values[i][COL.business - 1] || ''),
        phone: String(values[i][COL.phone - 1] || ''),
        status: String(values[i][COL.status - 1] || ''),
        token: token
      };
    }
  }
  return null;
}

function isSubmitted_(status) {
  return String(status || '').trim().toLowerCase() === 'submitted';
}

function appendLog_(found, answers, result, when) {
  var log = getLogSheet_();
  log.appendRow([
    when || new Date(),
    result,
    found.name,
    found.business,
    found.phone,
    found.token
  ].concat(answers));
  log.getRange(log.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function getMembersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Members');
  if (!sheet) {
    var only = ss.getSheets().length === 1 ? ss.getSheets()[0] : null;
    if (only && only.getLastRow() === 0) {
      only.setName('Members');
      sheet = only;
    } else {
      sheet = ss.insertSheet('Members', 0);
    }
  }
  ensureHeaders_(sheet, MEMBER_HEADERS);
  return sheet;
}

function getLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Responses log');
  if (!sheet) sheet = ss.insertSheet('Responses log');
  ensureHeaders_(sheet, LOG_HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var first = String(sheet.getRange(1, 1).getValue() || '');
  if (sheet.getLastRow() === 0 || first === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (first !== headers[0]) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    for (var c = 0; c < headers.length; c++) {
      var cell = sheet.getRange(1, c + 1);
      if (String(cell.getValue() || '') === '') cell.setValue(headers[c]);
    }
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function newToken_(used) {
  var token = '';
  do {
    token = randomToken_();
  } while (used[token]);
  return token;
}

function randomToken_() {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + '|' + Utilities.getUuid()
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function linkFor_(token) {
  return LINK_PREFIX + token;
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

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
