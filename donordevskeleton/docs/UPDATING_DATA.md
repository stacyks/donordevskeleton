# Updating the Donor Data

Use this routine whenever donors are added, removed, or rescored in the ESC Decision Matrix spreadsheet. No code changes are needed.

## 1. Update the spreadsheet

Add or edit rows on the **Donor Score Input** tab. Each donor needs:

| Column | Allowed values |
|---|---|
| Donor | Name shown on the chart |
| Historical Giving | -1, 0, or 1 |
| Affiliation with ESC/Student Programming | -1, 0, or 1 |
| Alignment with Free Market | -1, 0, or 1 |
| Affiliaiton with UMD | -1, 0, or 1 |
| Warm Connections | -1, 0, or 1 |

Persona, Total Score, and Tier Rank are calculated by the spreadsheet and carried into the chart's side panel. The **Rating Guide** tab explains what each score means. Do not rename the column headers, because the script finds the columns by name.

## 2. Download it into the repo

Download **either** of these into `data/raw/`:

- **The whole workbook (recommended):** File > Download > Microsoft Excel (.xlsx). The script reads the "Donor Score Input" tab.
- **Just the tab as CSV:** open the Donor Score Input tab, then File > Download > Comma Separated Values (.csv). Google names it `ESC_Decision_Matrix_Template.xlsx - Donor Score Input.csv`. Keep "Donor Score Input" in the file name.

The script uses the **most recently downloaded** matching file in `data/raw/`, so you can leave older downloads there. To keep things tidy, delete the old one.

## 3. Rebuild the chart data

From the repo folder in a terminal (in VS Code: Terminal > New Terminal):

```bash
python3 scripts/build_data.py
```

It prints which file it read, the weights, and a table showing every donor's scores and position. Check for any `Warning:` lines. They point out blank scores (treated as 0) or values outside -1 to 1.

To leave test rows off the chart, add their names to the `EXCLUDE` list near the top of `scripts/build_data.py`.

## 4. Check the chart

```bash
python3 -m http.server 8000
```

Open http://localhost:8000, click a few points, then press `Ctrl+C` in the terminal to stop the server.

## 5. Commit and push

```bash
git pull
git add data/
git commit -m "Update donor data"
git push
```

If you changed weights or other code at the same time, use `git add .` instead of `git add data/` and describe the change in the commit message.

## Quick reference

```bash
# after downloading the new spreadsheet into data/raw/
python3 scripts/build_data.py
git add data/ && git commit -m "Update donor data" && git push
```
