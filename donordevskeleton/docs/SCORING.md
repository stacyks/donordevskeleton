# How Donors Are Placed on the Chart

Each donor is scored -1, 0, or 1 on five criteria in the spreadsheet (see its **Rating Guide** tab). `scripts/build_data.py` combines those scores into two numbers: **impact** (vertical axis) and **effort** (horizontal axis).

## The weights

| Criterion | Impact weight | Lowers effort by |
|---|---|---|
| Historical Giving | **3** (highest) | **3** (most) |
| Alignment with Free Market | 2 (medium-high) | not used |
| Affiliation with ESC/Student Programming | 1.5 (medium) | 1.5 |
| Warm Connections | not used | 2 |
| Affiliation with UMD | not used | 1.5 |

**Impact** asks how valuable a gift would be: a track record of giving matters most, followed by fit with the center's mission.

**Effort** asks how much work it would take to land the donor. Existing ties make a donor easier to land, so a score of +1 **lowers** effort by the weight and a score of -1 **raises** it. Past giving is the strongest sign that a donor is easy to land.

## The formula

1. **Raw impact** = sum of (score x impact weight)
2. **Raw effort** = negative sum of (score x effort weight)
3. Each raw total is **rescaled to -5 to 5**: divide by the largest total possible (the sum of that axis's weights), then multiply by 5.

Rescaling keeps the chart's axes the same no matter how the weights change. A donor at +5 impact scored +1 on every impact criterion.

## Worked example: Apex Foundation

Scores: Historical Giving 0, ESC 1, Free Market 1, UMD 1, Warm Connections 1.

| Impact | Score | Weight | Adds |
|---|---|---|---|
| Historical Giving | 0 | x3 | 0 |
| Free Market | 1 | x2 | +2 |
| ESC | 1 | x1.5 | +1.5 |
| **Raw total (out of 6.5)** | | | **+3.5** |

3.5 / 6.5 x 5 = **2.69 impact**

| Effort | Score | Weight | Adds |
|---|---|---|---|
| Historical Giving | 0 | x3 | 0 |
| Warm Connections | 1 | x2 | -2 |
| ESC | 1 | x1.5 | -1.5 |
| UMD | 1 | x1.5 | -1.5 |
| **Raw total (out of 8)** | | | **-5** |

-5 / 8 x 5 = **-3.12 effort**

High impact and low effort put Apex in **Quick Wins**. The same breakdown appears in the chart's side panel when you click a point.

## Quadrants

| | Low effort (left) | High effort (right) |
|---|---|---|
| **High impact (top)** | Quick Wins | Strategic Investments |
| **Low impact (bottom)** | Low Priority | Reconsider Investment |

A donor with exactly 0 on either axis sits on a dividing line and is listed as "On a dividing line" in the data.

## Adjusting the weights

1. Open `scripts/build_data.py` and edit `IMPACT_WEIGHTS` and `EFFORT_REDUCERS` near the top.
   - Raise a weight to make that criterion move points further.
   - Add a criterion to an axis by adding its key; remove one by deleting its line.
   - Keys: `historical_giving`, `esc_affiliation`, `free_market`, `umd_affiliation`, `warm_connections`.
2. Run `python3 scripts/build_data.py` and read the printed table, or open `data/score_breakdown.csv` in Excel or Sheets.
3. Refresh the chart. If a donor is not where you expect, click it to see which criterion is driving its position.

The side panel reads the weights from `data/weights.json`, which the script rewrites every run, so the panel always matches the current weights.
