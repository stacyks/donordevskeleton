"""
Convert the ESC Decision Matrix spreadsheet into chart data.

Usage:
    python3 scripts/build_data.py              # uses the newest spreadsheet export in data/raw/
    python3 scripts/build_data.py path/to/file # or point it at a specific .xlsx or .csv

Input can be the whole workbook (.xlsx, reads the "Donor Score Input" tab)
or a CSV download of just that tab (file name must contain "Donor Score Input").
See docs/UPDATING_DATA.md and docs/SCORING.md.

Writes:
    data/donors.csv           what the chart plots
    data/weights.json         the weights below, so the side panel can show the math
    data/score_breakdown.csv  every donor's score x weight contributions (open in Excel/Sheets)
and prints the same breakdown in the terminal.
"""

import json
import sys
from pathlib import Path

import pandas as pd

# ---------- Configuration ----------
# Paths are relative to the repo root, so the script works from any folder.
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUTPUT = ROOT / "data" / "donors.csv"
WEIGHTS_OUTPUT = ROOT / "data" / "weights.json"
BREAKDOWN_OUTPUT = ROOT / "data" / "score_breakdown.csv"
SHEET_NAME = "Donor Score Input"  # only used for .xlsx input

# Names to leave off the chart (test rows, etc.). Example: ["Pranav"]
EXCLUDE = []

# ---------- Weights: edit these to move points around ----------
# Every criterion score is -1, 0 or 1. A donor's axis value is the sum of
# (score x weight), so a bigger weight means that criterion moves the point further.

# IMPACT: a score of +1 raises impact by the weight, -1 lowers it.
IMPACT_WEIGHTS = {
    "historical_giving": 3,    # highest
    "free_market": 2,          # medium-high
    "esc_affiliation": 1.5,    # medium (set to 2 to match free market exactly)
}

# EFFORT: these are ties that make a donor EASIER to land, so a score of +1
# LOWERS effort by the weight and -1 raises it.
EFFORT_REDUCERS = {
    "historical_giving": 3,    # lowers effort the most
    "warm_connections": 2,     # lowers effort a lot
    "esc_affiliation": 1.5,    # lowers effort somewhat
    "umd_affiliation": 1.5,    # lowers effort somewhat
}

# Both axes are rescaled so the most extreme possible donor lands at +/- SCALE_TO.
# Keep this equal to AXIS_MAX in js/script.js.
SCALE_TO = 5

# Spreadsheet header -> short column name used by the chart.
# Both spellings of the UMD column are listed because the sheet has a typo.
SCORE_COLUMNS = {
    "Historical Giving": "historical_giving",
    "Affiliation with ESC/Student Programming": "esc_affiliation",
    "Alignment with Free Market": "free_market",
    "Affiliaiton with UMD": "umd_affiliation",
    "Affiliation with UMD": "umd_affiliation",
    "Warm Connections": "warm_connections",
}

LABELS = {
    "historical_giving": "Historical Giving",
    "esc_affiliation": "Affiliation with ESC/Student Programming",
    "free_market": "Alignment with Free Market",
    "umd_affiliation": "Affiliation with UMD",
    "warm_connections": "Warm Connections",
}

SHORT = {
    "historical_giving": "HG",
    "esc_affiliation": "ESC",
    "free_market": "FM",
    "umd_affiliation": "UMD",
    "warm_connections": "Warm",
}


def find_input():
    """Newest .xlsx, or newest CSV named like the Donor Score Input tab, in data/raw/."""
    candidates = [p for p in RAW_DIR.glob("*.xlsx") if not p.name.startswith("~$")]
    candidates += [p for p in RAW_DIR.glob("*.csv") if "donor score input" in p.name.lower()]
    if not candidates:
        sys.exit(f"No spreadsheet found in {RAW_DIR}. See docs/UPDATING_DATA.md.")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def load_sheet(path):
    if path.suffix.lower() in (".xlsx", ".xlsm", ".xls"):
        return pd.read_excel(path, sheet_name=SHEET_NAME)
    return pd.read_csv(path)


def quadrant(impact, effort):
    if impact == 0 or effort == 0:
        return "On a dividing line"
    if impact > 0:
        return "Quick Win" if effort < 0 else "Strategic Investment"
    return "Low Priority" if effort < 0 else "Reconsider Investment"


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else find_input()
    if not path.exists():
        sys.exit(f"Input file not found: {path}")
    print(f"Reading {path.name}")

    df = load_sheet(path)
    df.columns = df.columns.astype(str).str.strip()

    # Keep only real donor rows (the sheet has helper tables off to the right
    # and template rows with no name further down).
    df = df[df["Donor"].notna() & (df["Donor"].astype(str).str.strip() != "")].copy()
    df["Donor"] = df["Donor"].astype(str).str.strip()
    df = df[~df["Donor"].isin(EXCLUDE)]

    df = df.rename(columns={"Donor": "peer", **SCORE_COLUMNS})
    score_keys = list(LABELS)
    missing = [k for k in score_keys if k not in df.columns]
    if missing:
        sys.exit(f"Missing score columns in spreadsheet: {missing}")

    for key in score_keys:
        df[key] = pd.to_numeric(df[key], errors="coerce")
    # Skip rows with no scores at all (notes typed into the Donor column).
    df = df[df[score_keys].notna().any(axis=1)].copy()

    for key in score_keys:
        blanks = df.loc[df[key].isna(), "peer"].tolist()
        if blanks:
            print(f"Warning: blank {key} for {blanks}, treating as 0")
        df[key] = df[key].fillna(0).astype(int)
        odd = df.loc[~df[key].isin([-1, 0, 1]), "peer"].tolist()
        if odd:
            print(f"Warning: {key} outside -1..1 for {odd}")

    # ---------- Weighted scores ----------
    impact_max = sum(IMPACT_WEIGHTS.values())
    effort_max = sum(EFFORT_REDUCERS.values())

    for key, w in IMPACT_WEIGHTS.items():
        df[f"impact_{key}"] = df[key] * w
    for key, w in EFFORT_REDUCERS.items():
        df[f"effort_{key}"] = -df[key] * w

    df["impact_raw"] = df[[f"impact_{k}" for k in IMPACT_WEIGHTS]].sum(axis=1)
    df["effort_raw"] = df[[f"effort_{k}" for k in EFFORT_REDUCERS]].sum(axis=1)
    df["impact"] = (df["impact_raw"] / impact_max * SCALE_TO).round(2)
    df["effort"] = (df["effort_raw"] / effort_max * SCALE_TO).round(2)
    df["quadrant"] = [quadrant(i, e) for i, e in zip(df["impact"], df["effort"])]

    df["total_score"] = pd.to_numeric(df.get("Total Score"), errors="coerce")
    df["total_score"] = df["total_score"].fillna(df[score_keys].sum(axis=1)).astype(int)
    df["persona"] = df.get("Persona", "").fillna("").astype(str).str.strip()
    df["tier_rank"] = pd.to_numeric(df.get("Tier Rank"), errors="coerce").astype("Int64")

    # ---------- Outputs ----------
    chart_cols = ["peer", "persona", "tier_rank", "total_score", *score_keys,
                  "impact_raw", "effort_raw", "impact", "effort", "quadrant"]
    df[chart_cols].to_csv(OUTPUT, index=False)

    breakdown_cols = ["peer", "persona", *score_keys,
                      *[f"impact_{k}" for k in IMPACT_WEIGHTS], "impact_raw", "impact",
                      *[f"effort_{k}" for k in EFFORT_REDUCERS], "effort_raw", "effort",
                      "quadrant"]
    df[breakdown_cols].sort_values(["impact", "effort"], ascending=[False, True]) \
        .to_csv(BREAKDOWN_OUTPUT, index=False)

    weights = {
        "scale_to": SCALE_TO,
        "impact": {"max": impact_max,
                   "weights": [{"key": k, "label": LABELS[k], "weight": w}
                               for k, w in IMPACT_WEIGHTS.items()]},
        "effort": {"max": effort_max,
                   "weights": [{"key": k, "label": LABELS[k], "weight": w}
                               for k, w in EFFORT_REDUCERS.items()]},
    }
    WEIGHTS_OUTPUT.write_text(json.dumps(weights, indent=2))

    # ---------- Terminal summary ----------
    print(f"Wrote {len(df)} donors to data/donors.csv, data/score_breakdown.csv, data/weights.json\n")
    print("Impact weights: " + ", ".join(f"{SHORT[k]} x{w}" for k, w in IMPACT_WEIGHTS.items())
          + f"  (raw range +/-{impact_max})")
    print("Effort reducers: " + ", ".join(f"{SHORT[k]} x{w}" for k, w in EFFORT_REDUCERS.items())
          + f"  (raw range +/-{effort_max})")
    print(f"Both axes rescaled to +/-{SCALE_TO}\n")

    table = df[["peer", *score_keys, "impact_raw", "impact", "effort_raw", "effort", "quadrant"]] \
        .rename(columns={**SHORT, "peer": "Donor"}) \
        .sort_values(["impact", "effort"], ascending=[False, True])
    print(table.to_string(index=False))


if __name__ == "__main__":
    main()
