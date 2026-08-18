const SHEET_NAME = 'Ballots';
const RESULTS_SHEET_NAME = 'Results';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    validateBallot_(data);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = getOrCreateBallotSheet_(spreadsheet);
      const row = [new Date(), data.ballot || 'Top 25', data.name, data.email]
        .concat(data.picks)
        .concat([fingerprint_(data.email)]);
      sheet.appendRow(row);
      refreshResults_(spreadsheet);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Ducks Rising Top 25 ballot' });
}

function validateBallot_(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid request.');
  if (!String(data.name || '').trim()) throw new Error('Name is required.');
  if (!/^\S+@\S+\.\S+$/.test(String(data.email || ''))) throw new Error('Valid email is required.');
  if (!Array.isArray(data.picks) || data.picks.length !== 25) throw new Error('Exactly 25 picks are required.');
  if (data.picks.some(function(pick) { return !String(pick || '').trim(); })) throw new Error('Every rank needs a team.');
  if (new Set(data.picks).size !== 25) throw new Error('Teams cannot be repeated.');
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

function refreshResults_(spreadsheet) {
  const ballotSheet = spreadsheet.getSheetByName(SHEET_NAME);
  let resultsSheet = spreadsheet.getSheetByName(RESULTS_SHEET_NAME);
  if (!resultsSheet) resultsSheet = spreadsheet.insertSheet(RESULTS_SHEET_NAME);
  const values = ballotSheet.getDataRange().getValues();
  const totals = {};
  values.slice(1).forEach(function(row) {
    row.slice(4, 29).forEach(function(team, index) {
      if (!team) return;
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
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase().trim());
  return bytes.map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 16);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
