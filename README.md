# ESC Donor Prioritization Chart

An interactive D3 quadrant chart that places prospective ESC donors by **impact** (how valuable a gift would be) and **effort** (how much work it would take to land them). The data is read live from the ESC Decision Matrix Google Sheet through a Google Apps Script endpoint, so the chart updates as soon as the sheet changes.

Click any point to see the donor's persona, tier, and the exact math behind where it sits.

## How it works

```
Google Sheet  →  Apps Script web app (JSON)  →  Chart page on GitHub Pages
 (client edits)     apps-script/Code.gs            index.html + js/
```

1. The client adds or edits donors in the Google Sheet. Weights live on its Chart Settings tab.
2. `apps-script/Code.gs`, deployed as a web app from inside the sheet, reads the sheet and returns the scored donors as JSON.
3. The chart page fetches that JSON every time it loads or **Refresh data** is clicked.

## Repo layout

```
donordevskeleton/
├── index.html              Page: title, data status bar, chart, side panel
├── css/styles.css          Styling
├── js/
│   ├── config.js           The Apps Script web app URL (set once per deployment)
│   ├── script.js           Fetches the data and draws the chart and side panel
│   └── vendor/             Local copy of D3 v7
├── apps-script/
│   └── Code.gs             The endpoint, pasted into the sheet's Apps Script editor
├── data/sample.json        Placeholder data shown when no endpoint is set
└── docs/
    ├── DEPLOYMENT.md       Step by step setup: Apps Script, GitHub, GitHub Pages, handoff
    ├── CLIENT_GUIDE.md     For the client: adding donors, reading the chart, weights
    ├── SCORING.md          How impact and effort are calculated
    └── CODE_GUIDE.md       Files, functions, JSON format, local development
```

## Where to start

- **Setting this up for the first time:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Using the chart as a client:** [docs/CLIENT_GUIDE.md](docs/CLIENT_GUIDE.md)
- **Understanding or changing the scoring:** [docs/SCORING.md](docs/SCORING.md)
- **Working on the code:** [docs/CODE_GUIDE.md](docs/CODE_GUIDE.md)

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. With no endpoint set in `js/config.js`, the chart shows `data/sample.json`.
