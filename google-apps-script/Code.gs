/**
 * PPS2114 C++ Assessment — Google Sheets recorder.
 *
 * SETUP (see README.md for full steps):
 * 1. Create a Google Spreadsheet.
 * 2. Extensions > Apps Script, paste this file, save.
 * 3. Deploy > New deployment > type "Web app"
 *      Execute as:      Me
 *      Who has access:  Anyone
 * 4. Copy the /exec URL into js/config.js (SHEETS_WEBAPP_URL).
 *
 * Each submission is appended as one row on a sheet named "Results"
 * (created automatically), with one column per question plus totals.
 */

var SHEET_NAME = "Results";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    // Build the header row on first use (or when question set changes size).
    var qCols = (data.questions || []).map(function (q) { return q.id + " (/" + q.max + ")"; });
    var header = ["Timestamp", "Assessment", "Name", "Student ID", "Class",
                  "Total", "Max", "Percent"].concat(qCols).concat(["Notes"]);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(header);
      sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var qScores = (data.questions || []).map(function (q) { return q.score; });
    var notes = (data.questions || [])
      .map(function (q) { return q.id + ": " + q.note; })
      .join(" | ");

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.assessment || "",
      data.name || "",
      data.studentId || "",
      data["class"] || "",
      data.total,
      data.maxTotal,
      data.percent,
    ].concat(qScores).concat([notes]));

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Quick sanity check: run this in the editor to verify sheet access. */
function testAppend() {
  var e = { postData: { contents: JSON.stringify({
    assessment: "TEST", timestamp: new Date().toISOString(),
    name: "Test Student", studentId: "T000", "class": "TEST",
    total: 10, maxTotal: 33, percent: 30.3,
    questions: [
      { id: "T1", score: 2, max: 2, note: "Correct" },
      { id: "C1", score: 5, max: 5, note: "3/3 test cases passed" }
    ]
  })}};
  Logger.log(doPost(e).getContent());
}
