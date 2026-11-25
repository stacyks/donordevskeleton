# Code Guide

What each file does, the data format between the endpoint and the chart, and how to work on the code locally. For first-time setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

## How data flows

```
Google Sheet
  Donor Score Input tab  (donor names + five scores)
  Chart Settings tab     (weights)
        │
        ▼
apps-script/Code.gs  (runs on Google's servers as a web app)
  doGet() → getChartData(): reads both tabs, applies weights, rescales to -5..5
        │  JSON over HTTPS
        ▼
js/script.js  (runs in the viewer's browser, page hosted on GitHub Pages)
  loadData() → drawPoints() + side panel
```

Nothing is copied or converted by hand. The chart asks the endpoint for fresh data each time it loads or **Refresh data** is clicked.

## Files

| File | Purpose |
|---|---|
| `apps-script/Code.gs` | The endpoint. Lives in the repo as the source of truth and is pasted into the sheet's Apps Script editor. |
| `index.html` | Page layout: title, data status bar, chart, side panel. |
| `js/config.js` | `ENDPOINT` (web app URL) and optional `KEY`. The only file that changes per deployment. |
| `js/script.js` | Fetches the JSON, draws axes, quadrants, points, tooltip, and the side panel math. |
| `js/vendor/d3.v7.min.js` | Local copy of D3 v7 (license in `d3-LICENSE.txt`). |
| `css/styles.css` | Page, chart, status bar, and side panel styles. |
| `data/sample.json` | Placeholder data in the endpoint's format, shown when `ENDPOINT` is blank. |

### `apps-script/Code.gs`

| Setting or function | Purpose |
|---|---|
| `SCORE_SHEET`, `SETTINGS_SHEET` | Tab names it reads |
| `SCALE_TO` | Axis range after rescaling (must match `AXIS_MAX` in `js/script.js`) |
| `EXCLUDE` | Donor names to leave off the chart |
| `CRITERIA` | The five criteria and every accepted spelling of their column headers |
| `DEFAULT_WEIGHTS` | Weights used when the Chart Settings tab or a cell in it is missing |
| `doGet(e)` | Web app entry point. Checks the optional key, returns JSON. |
| `getChartData()` | Reads the sheet, skips empty and note rows, flags bad scores, computes positions. |
| `setupChartSettings()` | Run once from the editor to create the Chart Settings tab. |
| `testChartData()` | Run from the editor to print what the endpoint returns. |

### `js/script.js`

| Setting or function | Purpose |
|---|---|
| `AXIS_MIN`, `AXIS_MAX`, `AXIS_PAD` | Axis range and padding past the last tick |
| `OVERLAP_SPREAD` | Donors with identical positions are spread in a small circle this wide |
| `SCORE_FIELDS` | Criterion labels listed in the side panel |
| `loadData()` | Fetches the endpoint (or `data/sample.json`), handles errors |
| `showStatus()` | The "N donors, live from the spreadsheet, as of ..." line and warnings |
| `drawPoints()` | Places the points; keyed by donor name so Refresh updates them in place |
| `showPanel()`, `breakdownHTML()` | The side panel and its score x weight tables |

## JSON format

The endpoint returns:

```json
{
  "generated": "2026-11-25T22:19:24.775Z",
  "scale_to": 5,
  "weights": {
    "scale_to": 5,
    "impact": { "max": 6.5, "weights": [{ "key": "historical_giving", "label": "Historical Giving", "weight": 3 }] },
    "effort": { "max": 8, "weights": [{ "key": "historical_giving", "label": "Historical Giving", "weight": 3 }] }
  },
  "donors": [
    {
      "peer": "Apex Foundation",
      "historical_giving": 0, "free_market": 1, "esc_affiliation": 1, "warm_connections": 1, "umd_affiliation": 1,
      "impact_raw": 3.5, "effort_raw": -5, "impact": 2.69, "effort": -3.12,
      "quadrant": "Quick Win", "total_score": 4, "persona": "Superstar", "tier_rank": 1
    }
  ],
  "warnings": ["Apex Foundation: Historical Giving is blank, counted as 0"]
}
```

On failure it returns `{"error": "..."}`, which the chart shows in red. `data/sample.json` uses the same format.

## Working on the code locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. With `ENDPOINT` blank in `js/config.js`, the chart uses `data/sample.json`, so you can work on the look of the chart without touching the sheet. With `ENDPOINT` set, it reads the live sheet.

To change the endpoint logic, edit `apps-script/Code.gs`, paste it into the Apps Script editor, run `testChartData` to check the output, then deploy a new version (DEPLOYMENT.md, "Changing things later").

## Troubleshooting

See the troubleshooting table at the end of [DEPLOYMENT.md](DEPLOYMENT.md).
