# Code Guide

How the pieces fit together, what each file does, and fixes for common problems.

## How data flows

```
ESC Decision Matrix spreadsheet
        │  download into data/raw/
        ▼
scripts/build_data.py   (applies the weights, rescales to -5..5)
        │
        ├── data/donors.csv           read by js/script.js to draw the points
        ├── data/weights.json         read by js/script.js for the side panel math
        └── data/score_breakdown.csv  for people: open in Excel or Sheets
        ▼
index.html + js/script.js + css/styles.css   (the chart in the browser)
```

## Files

### `scripts/build_data.py`
Reads the Donor Score Input tab, skips rows with no name or no scores (template rows and notes), applies the weights, and writes the three generated files. The settings at the top are the only part you normally edit:

| Setting | Purpose |
|---|---|
| `EXCLUDE` | Donor names to leave off the chart |
| `IMPACT_WEIGHTS` | Weight of each criterion on impact |
| `EFFORT_REDUCERS` | How much each criterion lowers effort |
| `SCALE_TO` | Axis range after rescaling (must match `AXIS_MAX` in `js/script.js`) |
| `SCORE_COLUMNS` | Maps spreadsheet headers to the short names used in code |

### `js/script.js`
Draws the chart with D3 v7. Settings at the top:

| Setting | Purpose |
|---|---|
| `AXIS_MIN`, `AXIS_MAX` | Axis range, kept equal to `SCALE_TO` |
| `AXIS_PAD` | Extra room past the last tick so edge points are not clipped |
| `OVERLAP_SPREAD` | Donors with identical positions are spread in a small circle this wide |
| `SCORE_FIELDS` | Criterion labels listed in the side panel |

The quadrant labels are in the `quadrants` array. The side panel is built in `showPanel()` and `breakdownHTML()`.

### `index.html` and `css/styles.css`
The page title, description, chart container, and side panel. The panel styles are at the bottom of `styles.css`.

## Generated file formats

### `data/donors.csv`
| Column | Meaning |
|---|---|
| `peer` | Donor name |
| `persona`, `tier_rank`, `total_score` | Copied from the spreadsheet |
| `historical_giving`, `esc_affiliation`, `free_market`, `umd_affiliation`, `warm_connections` | Criterion scores (-1, 0, 1) |
| `impact_raw`, `effort_raw` | Weighted sums before rescaling |
| `impact`, `effort` | Plotted position, -5 to 5 |
| `quadrant` | Which quadrant the donor falls in |

### `data/score_breakdown.csv`
The same donors sorted by impact, with one column per contribution (for example `impact_historical_giving`, `effort_warm_connections`) so you can see which criterion moves each point.

### `data/weights.json`
The weights and the maximum raw total for each axis. The side panel uses it to show the math.

## Troubleshooting

**The page says it could not load the data.**
The page was opened as a file. Serve it with `python3 -m http.server 8000` and open http://localhost:8000, or use Live Server. If it still fails, run `python3 scripts/build_data.py` so the files in `data/` exist.

**`No spreadsheet found in data/raw`.**
Download the workbook (.xlsx) or the Donor Score Input tab (.csv) into `data/raw/`. A CSV must have "Donor Score Input" in its file name.

**`Missing score columns in spreadsheet`.**
A column header was renamed in the spreadsheet. Change it back, or add the new header to `SCORE_COLUMNS` in `build_data.py`.

**`pip install` fails with "externally managed environment" (common on Mac with Homebrew Python).**
Use a virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```
Run `source .venv/bin/activate` in each new terminal before running the script. The `.venv` folder is ignored by git.

**A donor shows up that should not.**
Add the name to `EXCLUDE` in `build_data.py` and run it again.

**Points pile up in one corner.**
That is the weights at work. See [SCORING.md](SCORING.md) to rebalance them.
