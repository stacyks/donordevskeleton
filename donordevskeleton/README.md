# ESC Donor Prioritization Chart

An interactive D3 quadrant chart that places prospective ESC donors by **impact** (how valuable a gift would be) and **effort** (how much work it would take to land them). The data comes from the ESC Decision Matrix spreadsheet, and a Python script turns that spreadsheet into what the chart reads.

Click any point to see the donor's persona, tier, and the exact math behind where it sits.

## Repo layout

```
donordevskeleton/
├── index.html                 Page that holds the chart and side panel
├── css/styles.css             Page, chart, and side panel styling
├── js/script.js               D3 chart: axes, quadrants, points, tooltip, side panel
├── scripts/build_data.py      Converts the spreadsheet into chart data (weights live here)
├── data/
│   ├── raw/                   Put spreadsheet downloads here
│   ├── donors.csv             Generated: what the chart plots
│   ├── weights.json           Generated: weights shown in the side panel
│   └── score_breakdown.csv    Generated: every donor's score x weight math
├── docs/
│   ├── UPDATING_DATA.md       Step by step: adding donors and publishing the update
│   ├── SCORING.md             How impact and effort are calculated, and how to adjust them
│   └── CODE_GUIDE.md          What each file does, data formats, troubleshooting
├── requirements.txt           Python libraries for the build script
└── .gitignore
```

Files marked "Generated" are rebuilt by the script. Edit the spreadsheet or the weights instead of editing them by hand.

## Quick start

You need Python 3 and a code editor (VS Code works well).

```bash
# 1. Install the build script's libraries (once)
python3 -m pip install -r requirements.txt

# 2. Rebuild the chart data from the newest spreadsheet in data/raw/
python3 scripts/build_data.py

# 3. Serve the page locally, then open http://localhost:8000
python3 -m http.server 8000
```

The page has to be served (step 3). Opening `index.html` by double clicking it will not load the data. In VS Code, the Live Server extension also works: right click `index.html` and choose "Open with Live Server". Press `Ctrl+C` in the terminal to stop the server.

## Adding or changing donors

1. Update the **Donor Score Input** tab of the ESC Decision Matrix spreadsheet.
2. Download it (File > Download > Microsoft Excel) into `data/raw/`.
3. Run `python3 scripts/build_data.py`.
4. Refresh the page, then commit and push.

Full walkthrough with git commands: [docs/UPDATING_DATA.md](docs/UPDATING_DATA.md).

## Changing how donors are placed

The weights for each criterion are at the top of `scripts/build_data.py`. See [docs/SCORING.md](docs/SCORING.md) for what they mean, a worked example, and how to tune them.

## More detail

[docs/CODE_GUIDE.md](docs/CODE_GUIDE.md) explains each file, the columns of every generated file, and fixes for common problems.
