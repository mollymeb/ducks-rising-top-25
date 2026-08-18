const SHEET_NAME = 'Ballots';
const RESULTS_SHEET_NAME = 'Results';
const MAX_REQUEST_BYTES = 20000;

// Keep this list in sync with TEAMS in app.js. The browser list is for the UI;
// this server-side list is the security boundary for direct requests.
const ALLOWED_TEAMS = [
  'Air Force', 'Akron', 'Alabama', 'Appalachian State', 'Arizona', 'Arizona State', 'Arkansas', 'Arkansas State', 'Army', 'Auburn',
  'Ball State', 'Baylor', 'Boise State', 'Boston College', 'Bowling Green', 'Buffalo', 'BYU',
  'California', 'Central Michigan', 'Charlotte', 'Cincinnati', 'Clemson', 'Coastal Carolina', 'Colorado', 'Colorado State', 'Connecticut',
  'Delaware', 'Duke', 'East Carolina', 'Eastern Michigan', 'FIU', 'Florida', 'Florida Atlantic', 'Florida State', 'Fresno State',
  'Georgia', 'Georgia Southern', 'Georgia State', 'Georgia Tech', "Hawai'i", 'Houston', 'Illinois', 'Indiana', 'Iowa', 'Iowa State',
  'Jacksonville State', 'James Madison', 'Kansas', 'Kansas State', 'Kent State', 'Kentucky', 'Kennesaw State', 'Liberty', 'Louisiana', 'Louisiana Tech', 'Louisville', 'LSU',
  'Marshall', 'Maryland', 'Memphis', 'Miami (FL)', 'Miami (OH)', 'Michigan', 'Michigan State', 'Middle Tennessee', 'Minnesota', 'Mississippi State', 'Missouri', 'Missouri State',
  'Navy', 'NC State', 'Nebraska', 'Nevada', 'New Mexico', 'New Mexico State', 'North Carolina', 'North Texas', 'Northern Illinois', 'Northwestern', 'Notre Dame',
  'Ohio', 'Ohio State', 'Oklahoma', 'Oklahoma State', 'Old Dominion', 'Ole Miss', 'Oregon', 'Oregon State',
  'Penn State', 'Pittsburgh', 'Purdue', 'Rice', 'Rutgers', 'Sam Houston', 'San Diego State', 'San Jose State', 'SMU', 'South Alabama', 'South Carolina', 'South Florida', 'Southern Miss', 'Stanford', 'Syracuse',
  'TCU', 'Temple', 'Tennessee', 'Texas', 'Texas A&M', 'Texas State', 'Texas Tech', 'Toledo', 'Troy', 'Tulane', 'Tulsa', 'UAB', 'UCF', 'UCLA', 'UL Monroe', 'UMass', 'UNLV', 'USC', 'UTEP', 'UTSA', 'Utah', 'Utah State',
  'Vanderbilt', 'Virginia', 'Virginia Tech', 'Wake Forest', 'Washington', 'Washington State', 'West Virginia', 'Western Kentucky', 'Western Michigan', 'Wisconsin', 'Wyoming'
];

const ALLOWED_TEAM_SET = new Set(ALLOWED_TEAMS);

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > MAX_REQUEST_BYTES) throw new Error('Invalid request size.');

    const data = JSON.parse(raw);
    if (data && typeof data.website === 'string' && data.website.trim()) {
      return json_({ ok: true });
    }
    const ballot = validateAndNormalizeBallot_(data);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let updated = false;
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = getOrCreateBallotSheet_(spreadsheet);
      const voterId = fingerprint_(ballot.email);
      const row = [new Date(), ballot.ballot, safeCell_(ballot.name), safeCell_(ballot.email)]
        .concat(ballot.picks)
        .concat([voterId]);
      const existingRow = findNewestVoterRow_(sheet, voterId);

      if (existingRow) {
        sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
        updated = true;
      } else {
        sheet.appendRow(row);
      }
      refreshResults_(spreadsheet);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true, updated: updated });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: error.message });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Ducks Rising Top 25 ballot' });
}

function validateAndNormalizeBallot_(data) {
  if (!data || Object.prototype.toString.call(data) !== '[object Object]') throw new Error('Invalid request.');

  const allowedFields = new Set(['name', 'email', 'ballot', 'picks', 'website']);
  Object.keys(data).forEach(function(key) {
    if (!allowedFields.has(key)) throw new Error('Unexpected request field.');
  });

  const name = requireString_(data.name, 'Name', 80);
  const email = requireString_(data.email, 'Email', 120).toLowerCase();
  const ballot = requireString_(data.ballot || 'Top 25', 'Ballot', 80);
  if (/[\u0000-\u001F\u007F]/.test(name)) throw new Error('Name contains invalid characters.');
  if (!/^[^\s@]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(email)) {
    throw new Error('Valid email is required.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._&'():/-]{0,79}$/.test(ballot)) throw new Error('Invalid ballot name.');
  if (!Array.isArray(data.picks) || data.picks.length !== 25) throw new Error('Exactly 25 picks are required.');

  const picks = data.picks.map(function(pick) {
    if (typeof pick !== 'string' || !ALLOWED_TEAM_SET.has(pick)) throw new Error('Ballot contains an unknown team.');
    return pick;
  });
  if (new Set(picks).size !== 25) throw new Error('Teams cannot be repeated.');

  return { name: name, email: email, ballot: ballot, picks: picks };
}

function requireString_(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(label + ' is required.');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(label + ' is invalid.');
  return normalized;
}

// Prevent spreadsheet formula interpretation for every user-controlled text cell.
function safeCell_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function getOrCreateBallotSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    const headers = ['Timestamp', 'Ballot', 'Name', 'Email'];
    for (let rank = 1; rank <= 25; rank++) headers.push('Rank ' + rank);
    headers.push('Voter ID');
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0e3427').setFontColor('#ffffff');
  }
  return sheet;
}

function findNewestVoterRow_(sheet, voterId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const voterIds = sheet.getRange(2, 30, lastRow - 1, 1).getDisplayValues();
  for (let index = voterIds.length - 1; index >= 0; index--) {
    if (voterIds[index][0] === voterId) return index + 2;
  }
  return 0;
}

function refreshResults_(spreadsheet) {
  const ballotSheet = spreadsheet.getSheetByName(SHEET_NAME);
  let resultsSheet = spreadsheet.getSheetByName(RESULTS_SHEET_NAME);
  if (!resultsSheet) resultsSheet = spreadsheet.insertSheet(RESULTS_SHEET_NAME);
  const values = ballotSheet.getDataRange().getValues();
  const newestByVoter = {};

  // Walking oldest to newest means a newer row replaces any historical duplicate.
  values.slice(1).forEach(function(row, index) {
    const voterId = String(row[29] || 'legacy-row-' + index);
    newestByVoter[voterId] = row;
  });

  const totals = {};
  Object.keys(newestByVoter).forEach(function(voterId) {
    const row = newestByVoter[voterId];
    row.slice(4, 29).forEach(function(team, index) {
      if (!ALLOWED_TEAM_SET.has(team)) return;
      if (!totals[team]) totals[team] = { points: 0, first: 0, ballots: 0 };
      totals[team].points += 25 - index;
      totals[team].ballots += 1;
      if (index === 0) totals[team].first += 1;
    });
  });

  const ranked = Object.keys(totals).map(function(team) {
    return [team, totals[team].points, totals[team].first, totals[team].ballots];
  }).sort(function(a, b) { return b[1] - a[1] || b[2] - a[2] || a[0].localeCompare(b[0]); });

  resultsSheet.clear();
  resultsSheet.getRange(1, 1, 1, 5).setValues([['Rank', 'Team', 'Points', 'First-place votes', 'Ballots']]);
  if (ranked.length) {
    const output = ranked.map(function(row, index) { return [index + 1].concat(row); });
    resultsSheet.getRange(2, 1, output.length, 5).setValues(output);
  }
  resultsSheet.setFrozenRows(1);
  resultsSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0e3427').setFontColor('#ffffff');
}

function fingerprint_(email) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email);
  return bytes.map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 16);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
