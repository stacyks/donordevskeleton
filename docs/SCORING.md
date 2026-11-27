# How Donors Are Placed on the Chart

Each donor is scored -1, 0, or 1 on five criteria in the spreadsheet (see its **Rating Guide** tab). `apps-script/Code.gs` combines those scores into two numbers: **impact** (vertical axis) and **effort** (horizontal axis), using the weights on the sheet's **Chart Settings** tab.

## The weights

These are the defaults that `setupChartSettings` writes to the Chart Settings tab:

| Criterion | Impact weight | Lowers effort by |
|---|---|---|
| Historical Giving | **3** (highest) | **3** (most) |
| Alignment with Free Market | 2 (medium-high) | 0 (not used) |
| Affiliation with ESC/Student Programming | 1.5 (medium) | 1.5 |
| Warm Connections | 0 (not used) | 2 |
| Affiliation with UMD | 0 (not used) | 1.5 |

**Impact** asks how valuable a gift would be: a track record of giving matters most, followed by fit with the center's mission.

**Effort** asks how much work it would take to land the donor. Existing ties make a donor easier to land, so a score of +1 **lowers** effort by the weight and a score of -1 **raises** it.

## The formula

1. **Raw impact** = sum of (score x impact weight)
2. **Raw effort** = negative sum of (score x effort weight)
3. Each raw total is **rescaled to -5 to 5**: divide by the largest total possible (the sum of that axis's weights), then multiply by 5.

Rescaling keeps the chart's axes the same no matter how the weights change.

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

High impact and low effort put Apex in **Quick Wins**. The chart itself does not show this math; run `testChartData` in the Apps Script editor to see every donor's raw and rescaled values.

## Quadrants

| | Low effort (left) | High effort (right) |
|---|---|---|
| **High impact (top)** | Quick Wins | Strategic Investments |
| **Low impact (bottom)** | Low Priority | Reconsider Investment |

A donor at exactly 0 on either axis is labeled "On a dividing line".

## Adjusting the weights

1. Edit the numbers on the **Chart Settings** tab. Raise a weight to make that criterion move points further; set it to 0 to drop it from that axis.
2. Click **Refresh data** on the chart.
3. If a donor is not where you expect, hover over it to see its criterion scores, or run `testChartData` for the full math.

If the Chart Settings tab is missing or a cell is blank, the script falls back to `DEFAULT_WEIGHTS` near the top of `Code.gs`. Donor names listed in `EXCLUDE` there are left off the chart.
