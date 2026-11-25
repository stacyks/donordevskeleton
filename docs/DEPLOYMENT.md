# Deployment Guide

This guide takes the project from a cloned repo to a live chart link the client can open. No prior deployment experience is assumed. Plan on about an hour the first time.

## How the pieces connect

```
Google Sheet (Donor Score Input + Chart Settings tabs)
        │  read live by
        ▼
Apps Script web app (apps-script/Code.gs)     URL: https://script.google.com/macros/s/.../exec
        │  returns donors + weights as JSON
        ▼
Chart page (index.html + js/)                 URL: https://<owner>.github.io/donordevskeleton/
        hosted on GitHub Pages, fetches the JSON every time it loads or "Refresh data" is clicked
```

The client only ever touches the Google Sheet and the chart link. Editing the sheet and clicking **Refresh data** on the chart is the whole update process.

## Before you start

You need:

- **Edit access to the Google Sheet the client will actually use.** The endpoint reads whichever sheet it is attached to, so set it up on the live copy, not a personal test copy.
- **A GitHub account,** and the repo cloned in VS Code.
- **Python 3,** only for previewing the chart on your own computer.

**Privacy:** for the chart page to load the data, the web app must allow access by "Anyone". Anyone who finds the web app URL can read every donor's name and scores, and the URL is visible in the chart page's source. GitHub Pages on a free account also requires a public repo. Only use this setup if the client accepts that donor names and scores are viewable by someone who goes looking.

---

## Part A: Prepare the Google Sheet

**A1. Convert the file to a native Google Sheet.** Apps Script cannot attach to an Excel file.
1. Open the spreadsheet from Google Drive.
2. If an **.XLSX** badge appears next to the title, click **File > Save as Google Sheets**. A new copy opens.
3. Use that new copy from now on. Its address bar no longer contains `rtpof=true`.

**A2. Remove test rows.** Delete or replace "Pranav" and "supreme leader riley" on the Donor Score Input tab.

**A3. Protect the header row.** The code finds columns by their header names, so a renamed header breaks the chart.
1. Click the row number **1** on Donor Score Input.
2. Right click > **View more cell actions > Protect range** (or **Data > Protect sheets and ranges**).
3. Click **Set permissions**, choose **Show a warning when editing this range**, then **Done**.

---

## Part B: Set up the Apps Script endpoint

**B1. Open the script editor.** In the sheet, click **Extensions > Apps Script**. A new tab opens with a file called `Code.gs` containing `function myFunction() {}`.

**B2. Name the project.** Click **Untitled project** at the top left, type `ESC Donor Chart`, and click **Rename**.

**B3. Paste in the code.**
1. In VS Code, open `apps-script/Code.gs`, press `Cmd+A` then `Cmd+C` (`Ctrl` on Windows).
2. In the Apps Script tab, click inside `Code.gs`, press `Cmd+A`, then `Cmd+V` to replace everything.
3. Press `Cmd+S` to save. The orange dot next to the file name disappears.

**B4. Create the Chart Settings tab.**
1. In the toolbar, open the function dropdown (next to **Debug**) and choose **setupChartSettings**.
2. Click **Run**.
3. The first run asks for permission: **Review permissions** > pick your Google account > on "Google hasn't verified this app", click **Advanced** > **Go to ESC Donor Chart (unsafe)** > **Allow**. This is normal for a script you wrote yourself. It only accesses this spreadsheet.
4. The **Execution log** at the bottom should say "Execution completed". Switch to the spreadsheet tab: a new **Chart Settings** tab holds the weights.

**B5. Check the data.** Choose **testChartData** in the dropdown and click **Run**. The Execution log prints the JSON the chart will receive. Confirm your donors are listed and `"warnings": []` is empty, or read what the warnings say and fix the sheet.

**B6. Deploy as a web app.**
1. Click the blue **Deploy** button (top right) > **New deployment**.
2. Click the gear icon next to **Select type** > **Web app**.
3. Fill in:
    - **Description:** `v1`
    - **Execute as:** **Me (your email)**. The script reads the sheet with your access, so viewers never see a permission prompt.
    - **Who has access:** **Anyone**
4. Click **Deploy**. Approve permissions again if asked.
5. Copy the **Web app URL**. It ends in `/exec`. Click **Done**.

**B7. Test the URL.** Paste it into a new browser tab. You should see raw JSON starting with `{"generated":`. If you see a Google sign-in page instead, "Who has access" is not set to Anyone: go to **Deploy > Manage deployments**, edit it, and fix the setting.

**B8 (optional). Add a key.** This blocks casual visitors who only have the bare URL.
1. In Apps Script, click the gear (**Project Settings**) in the left sidebar.
2. Scroll to **Script Properties** > **Add script property**. Property: `API_KEY`. Value: any long random text. Click **Save script properties**.
3. The URL now only works with `?key=<that value>` on the end. You will put the same value in `js/config.js` in Part C.

---

## Part C: Connect the chart in the repo

Open the repo folder in VS Code, then open a terminal with **Terminal > New Terminal**.

**C1. Start a branch.**
```bash
git pull
git checkout -b json-endpoint
```

**C2. Copy in the new files.** Unzip `donordevskeleton.zip` into Downloads, then run:
```bash
cp -R ~/Downloads/donordevskeleton/. .
rm -rf scripts dist data/raw data/donors.csv data/weights.json data/score_breakdown.csv requirements.txt docs/UPDATING_DATA.md
```
The second line removes files from the older versions that this setup no longer uses. It is safe to run even if some of them do not exist.

**C3. Point the chart at your endpoint.** Open `js/config.js` and paste the URL from B6 between the quotes:
```js
window.CHART_CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfy.../exec",
  KEY: ""
};
```
If you did B8, put the key value in `KEY`.

**C4. Preview it on your computer.**
```bash
python3 -m http.server 8000
```
Open http://localhost:8000 in your browser. The line above the chart should say **"live from the spreadsheet"**. To confirm the connection, add a test donor in the sheet, click **Refresh data**, and watch it appear. Delete the test donor afterward. Press `Ctrl+C` in the terminal to stop the server.

---

## Part D: Push to GitHub

```bash
git status
git add -A
git commit -m "Load chart data live from Google Sheets via Apps Script endpoint"
git push -u origin json-endpoint
```

`git add -A` includes the deleted files. If git asks who you are, run these once, then commit again:
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Then open the repo on GitHub, click **Compare & pull request**, and **Create pull request**. The repo owner reviews and merges it into `main`.

If the push fails with **403** or **Permission denied**, you do not have write access. Ask the owner to add you (**Settings > Collaborators > Add people**), or use your own fork (see Part E).

---

## Part E: Publish the chart with GitHub Pages

This step needs admin access to the repo, so the owner does it, or you do it on your own fork.

**On the original repo (the owner does this):**
1. Open the repo on GitHub > **Settings** > **Pages** (left sidebar).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`. Click **Save**.
4. Wait one or two minutes and refresh the page. It shows **"Your site is live at https://<owner>.github.io/donordevskeleton/"**.

**On your own fork instead:** click **Fork** on the repo page > **Create fork**. Push your branch to the fork, merge it into the fork's `main`, and follow steps 1 to 4 on the fork. The link becomes `https://<your-username>.github.io/donordevskeleton/`.

On a free GitHub account, the Pages option only appears for public repos.

Open the live link and confirm it says "live from the spreadsheet".

---

## Part F: Hand off to the client

**F1. Put the chart link inside the sheet.** On the How to Use tab, in an empty cell, type:
```
=HYPERLINK("https://<owner>.github.io/donordevskeleton/", "Open the donor chart")
```
The client clicks it whenever they want the chart. No code, no permission prompts.

**F2. Give them the client guide.** Copy the contents of [CLIENT_GUIDE.md](CLIENT_GUIDE.md) into the How to Use tab, or send it to them. Walk through adding one donor together.

**F3. Plan for ownership.** The web app runs as the Google account that deployed it. If that account loses access to the sheet, or the deployment is archived, the chart stops loading. For a long-term handoff, have someone at the client repeat Part B6 under their own account, then update `ENDPOINT` in `js/config.js` with their new URL.

---

## Changing things later

| What changed | What to do |
|---|---|
| Donors or scores | Nothing. Edit the sheet, then click Refresh data on the chart. |
| Weights | Edit the Chart Settings tab, then click Refresh data. |
| Chart look or behavior (`index.html`, `css/`, `js/`) | Edit in the repo, preview with C4, then commit, push, and merge. GitHub Pages updates within a few minutes. |
| `apps-script/Code.gs` | Edit it in the repo and paste it into the Apps Script editor as in B3. Then **Deploy > Manage deployments** > pencil icon > **Version: New version** > **Deploy**. The URL stays the same. Do not use **New deployment**, which creates a new URL. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| "sample data (no endpoint set in js/config.js)" | `ENDPOINT` in `js/config.js` is empty, or the new config was not pushed and merged. |
| "Could not load the donor data: Failed to fetch" | The URL is wrong, or "Who has access" is not Anyone. Test the URL directly in a browser (B7). |
| "Missing or incorrect key" | `KEY` in `js/config.js` does not match the `API_KEY` Script Property. |
| "No "..." column header on the Donor Score Input tab" | A header was renamed in the sheet. Rename it back. |
| Code edits in Apps Script have no effect | You saved but did not deploy a new version. See "Changing things later". |
| Chart is slow to appear | Normal: Google takes one to three seconds to run the script on each load. |
| Pages link shows a 404 | Pages was turned on less than a few minutes ago, or the branch is not `main` with `/ (root)`. |
