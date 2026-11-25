/**
 * ESC Donor Chart: JSON endpoint
 *
 * This script lives inside the ESC Decision Matrix Google Sheet
 * (Extensions > Apps Script). When deployed as a web app, its URL returns
 * the donors and their chart positions as JSON, read live from the sheet.
 * The chart page (index.html + js/script.js in the repo) fetches that URL.
 *
 * Functions you can run from the Apps Script editor (pick one in the
 * dropdown next to "Debug", then click "Run"):
 *   setupChartSettings  creates the Chart Settings tab with the default weights
 *   testChartData       prints what the endpoint will return, to check before deploying
 *
 * Full setup steps: docs/DEPLOYMENT.md in the repo.
 */

// ---------- Settings ----------
const SCORE_SHEET = "Donor Score Input";
const SETTINGS_SHEET = "Chart Settings";

// Both axes are rescaled so the most extreme possible donor lands at +/- SCALE_TO.
// Keep this equal to AXIS_MAX in js/script.js.
const SCALE_TO = 5;

// Donor names to leave off the chart (test rows, etc.). Example: ["Pranav"]
const EXCLUDE = [];

// The five criteria. "headers" lists every spelling accepted for the column
// header on the Donor Score Input tab (the sheet spells one of them "Affiliaiton").
const CRITERIA = [
  { key: "historical_giving", label: "Historical Giving", headers: ["Historical Giving"] },
  { key: "free_market", label: "Alignment with Free Market", headers: ["Alignment with Free Market"] },
  { key: "esc_affiliation", label: "Affiliation with ESC/Student Programming", headers: ["Affiliation with ESC/Student Programming"] },
  { key: "warm_connections", label: "Warm Connections", headers: ["Warm Connections"] },
  { key: "umd_affiliation", label: "Affiliation with UMD", headers: ["Affiliaiton with UMD", "Affiliation with UMD"] }
];

// Used when the Chart Settings tab is missing or a cell in it is blank.
// impact: a +1 score raises impact by this much.
// effort: a +1 score LOWERS effort by this much (existing ties make a donor easier to land).
const DEFAULT_WEIGHTS = {
  historical_giving: { impact: 3, effort: 3 },
  free_market: { impact: 2, effort: 0 },
  esc_affiliation: { impact: 1.5, effort: 1.5 },
  warm_connections: { impact: 0, effort: 2 },
  umd_affiliation: { impact: 0, effort: 1.5 }
};

// ---------- Web app entry point ----------
// Runs when someone opens the web app URL. Returns JSON either way:
// the chart data, or {"error": "..."} explaining what went wrong.
function doGet(e) {
  try {
    checkKey(e);
    return jsonResponse(getChartData());
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Optional: if a Script Property named API_KEY is set (Project Settings > Script
// Properties), requests must end in ?key=<that value>. This only stops casual
// access, since the key is visible in the chart page's source.
function checkKey(e) {
  const required = PropertiesService.getScriptProperties().getProperty("API_KEY");
  if (!required) return;
  const given = e && e.parameter ? e.parameter.key : undefined;
  if (given !== required) throw new Error("Missing or incorrect key.");
}

// ---------- Build the chart data ----------
function getChartData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCORE_SHEET);
  if (!sheet) throw new Error('No tab named "' + SCORE_SHEET + '" in the spreadsheet.');

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const findCol = names => {
    for (const name of names) {
      const i = headers.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };

  const donorCol = findCol(["Donor"]);
  if (donorCol < 0) throw new Error('No "Donor" column header on the ' + SCORE_SHEET + " tab.");
  const scoreCols = CRITERIA.map(c => {
    const i = findCol(c.headers);
    if (i < 0) throw new Error('No "' + c.headers[0] + '" column header on the ' + SCORE_SHEET + " tab.");
    return i;
  });
  const personaCol = findCol(["Persona"]);
  const tierCol = findCol(["Tier Rank"]);
  const totalCol = findCol(["Total Score"]);

  const weights = readWeights(ss);
  const impactMax = sumOf(CRITERIA.map(c => Math.abs(weights[c.key].impact)));
  const effortMax = sumOf(CRITERIA.map(c => Math.abs(weights[c.key].effort)));
  const warnings = [];
  const donors = [];

  values.slice(1).forEach(row => {
    const name = String(row[donorCol]).trim();
    if (!name || EXCLUDE.indexOf(name) >= 0) return;
    // Skip rows with no scores at all (notes typed into the Donor column).
    if (scoreCols.every(i => row[i] === "" || row[i] === null)) return;

    const d = { peer: name };
    CRITERIA.forEach((c, j) => {
      let v = row[scoreCols[j]];
      if (v === "" || v === null || isNaN(Number(v))) {
        warnings.push(name + ": " + c.label + " is blank, counted as 0");
        v = 0;
      }
      v = Number(v);
      if ([-1, 0, 1].indexOf(v) < 0) warnings.push(name + ": " + c.label + " is " + v + ", expected -1, 0, or 1");
      d[c.key] = v;
    });

    d.impact_raw = round2(sumOf(CRITERIA.map(c => d[c.key] * weights[c.key].impact)));
    d.effort_raw = round2(-sumOf(CRITERIA.map(c => d[c.key] * weights[c.key].effort)));
    d.impact = impactMax ? round2(d.impact_raw / impactMax * SCALE_TO) : 0;
    d.effort = effortMax ? round2(d.effort_raw / effortMax * SCALE_TO) : 0;
    d.quadrant = quadrant(d.impact, d.effort);

    const total = totalCol >= 0 ? Number(row[totalCol]) : NaN;
    d.total_score = isNaN(total) || row[totalCol] === "" ? sumOf(CRITERIA.map(c => d[c.key])) : total;
    d.persona = personaCol >= 0 ? String(row[personaCol]).trim() : "";
    d.tier_rank = tierCol >= 0 && row[tierCol] !== "" ? row[tierCol] : "";
    donors.push(d);
  });

  const axis = (field, max) => ({
    max: max,
    weights: CRITERIA
      .filter(c => weights[c.key][field] !== 0)
      .map(c => ({ key: c.key, label: c.label, weight: weights[c.key][field] }))
      .sort((a, b) => b.weight - a.weight)  // heaviest first in the side panel
  });

  return {
    generated: new Date().toISOString(),
    scale_to: SCALE_TO,
    weights: { scale_to: SCALE_TO, impact: axis("impact", impactMax), effort: axis("effort", effortMax) },
    donors: donors,
    warnings: warnings
  };
}

// Reads the Chart Settings tab: column A = criterion, B = impact weight,
// C = lowers effort by. Missing tab or blank cells fall back to DEFAULT_WEIGHTS.
function readWeights(ss) {
  const weights = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return weights;

  sheet.getDataRange().getValues().slice(1).forEach(row => {
    const label = String(row[0]).trim();
    const c = CRITERIA.find(c => c.label === label || c.headers.indexOf(label) >= 0);
    if (!c) return;
    if (row[1] !== "" && !isNaN(Number(row[1]))) weights[c.key].impact = Number(row[1]);
    if (row[2] !== "" && !isNaN(Number(row[2]))) weights[c.key].effort = Number(row[2]);
  });
  return weights;
}

function quadrant(impact, effort) {
  if (impact === 0 || effort === 0) return "On a dividing line";
  if (impact > 0) return effort < 0 ? "Quick Win" : "Strategic Investment";
  return effort < 0 ? "Low Priority" : "Reconsider Investment";
}

function sumOf(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

function round2(x) {
  return Math.round(x * 100) / 100 || 0;
}

// ---------- Helpers to run from the editor ----------

// Creates the Chart Settings tab filled with DEFAULT_WEIGHTS. Run once.
function setupChartSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(SETTINGS_SHEET)) {
    throw new Error('A "' + SETTINGS_SHEET + '" tab already exists. Rename or delete it first to make a fresh one.');
  }
  const sheet = ss.insertSheet(SETTINGS_SHEET);
  const rows = [["Criterion", "Impact weight", "Lowers effort by"]].concat(
    CRITERIA.map(c => [c.label, DEFAULT_WEIGHTS[c.key].impact, DEFAULT_WEIGHTS[c.key].effort])
  );
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  sheet.getRange(rows.length + 2, 1).setValue(
    "Higher number = that criterion moves donors further. 0 = not used on that axis. " +
    "Click Refresh data on the chart to see changes."
  );
  sheet.autoResizeColumns(1, 3);
}

// Prints exactly what the web app will return. Check the Execution log below the editor.
function testChartData() {
  Logger.log(JSON.stringify(getChartData(), null, 2));
}
