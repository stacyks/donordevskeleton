// ---------- Configuration ----------
// The data source (the Apps Script web app URL) is set in js/config.js.
// The data arrives already weighted and rescaled by apps-script/Code.gs.

// The five criterion scores (each -1, 0 or 1) listed in the side panel:
const SCORE_FIELDS = [
  { key: "historical_giving", label: "Historical Giving" },
  { key: "esc_affiliation", label: "Affiliation with ESC/Student Programming" },
  { key: "free_market", label: "Alignment with Free Market" },
  { key: "umd_affiliation", label: "Affiliation with UMD" },
  { key: "warm_connections", label: "Warm Connections" }
];

// Axes run from AXIS_MIN to AXIS_MAX, quadrants split at MIDPOINT.
// Code.gs rescales both axes to +/- SCALE_TO; keep AXIS_MAX equal to it.
// AXIS_PAD adds a little room past the last tick so edge points are not clipped.
const AXIS_MIN = -5;
const AXIS_MAX = 5;
const AXIS_PAD = 0.5;
const MIDPOINT = 0;

// Donors with identical scores would sit exactly on top of each other,
// so they are spread in a small circle this many axis units wide.
const OVERLAP_SPREAD = 0.18;

const margin = { top: 30, right: 40, bottom: 65, left: 65 };
const width = 850;
const height = 600;

// ---------- SVG + scales ----------
const svg = d3.select("#donor-chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const x = d3.scaleLinear()
  .domain([AXIS_MIN - AXIS_PAD, AXIS_MAX + AXIS_PAD])
  .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
  .domain([AXIS_MIN - AXIS_PAD, AXIS_MAX + AXIS_PAD])
  .range([height - margin.bottom, margin.top]);

// Quadrant dividing lines
svg.append("line")
  .attr("x1", x(MIDPOINT)).attr("x2", x(MIDPOINT))
  .attr("y1", margin.top).attr("y2", height - margin.bottom)
  .attr("stroke", "#888").attr("stroke-dasharray", "5,5").attr("stroke-width", 1.5);

svg.append("line")
  .attr("x1", margin.left).attr("x2", width - margin.right)
  .attr("y1", y(MIDPOINT)).attr("y2", y(MIDPOINT))
  .attr("stroke", "#888").attr("stroke-dasharray", "5,5").attr("stroke-width", 1.5);

// Quadrant labels, pinned to the corners of the plot area
const quadrants = [
  { label: "QUICK WINS",            px: margin.left + 8,         py: margin.top + 16,          anchor: "start" },
  { label: "STRATEGIC INVESTMENTS", px: width - margin.right - 8, py: margin.top + 16,          anchor: "end" },
  { label: "LOW PRIORITY",          px: margin.left + 8,         py: height - margin.bottom - 8, anchor: "start" },
  { label: "RECONSIDER INVESTMENT", px: width - margin.right - 8, py: height - margin.bottom - 8, anchor: "end" }
];

svg.selectAll(".quadrant-label")
  .data(quadrants)
  .join("text")
  .attr("class", "quadrant-label")
  .attr("x", d => d.px)
  .attr("y", d => d.py)
  .attr("text-anchor", d => d.anchor)
  .attr("font-size", "11px")
  .attr("font-weight", "bold")
  .attr("fill", "#777")
  .text(d => d.label);

// Axes
svg.append("g")
  .attr("transform", `translate(0,${height - margin.bottom})`)
  .call(d3.axisBottom(x).tickValues(d3.range(AXIS_MIN, AXIS_MAX + 1)));

svg.append("g")
  .attr("transform", `translate(${margin.left},0)`)
  .call(d3.axisLeft(y).tickValues(d3.range(AXIS_MIN, AXIS_MAX + 1)));

// Axis labels
svg.append("text")
  .attr("x", width / 2)
  .attr("y", height - 15)
  .attr("text-anchor", "middle")
  .text("Effort");

svg.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .text("Impact");

// ---------- Tooltip ----------
const tooltip = d3.select("body")
  .append("div")
  .style("position", "absolute")
  .style("visibility", "hidden")
  .style("background", "#222")
  .style("color", "#fff")
  .style("padding", "8px 12px")
  .style("border-radius", "6px")
  .style("font-size", "13px")
  .style("pointer-events", "none");

// ---------- Details panel ----------
const panel = document.getElementById("donor-details");
const panelContent = document.getElementById("donor-details-content");
let selectedCircle = null;
let weights = null; // arrives with the data from the endpoint

function closePanel() {
  panel.hidden = true;
  if (selectedCircle) {
    selectedCircle.attr("stroke", "#fff").attr("stroke-width", 2);
    selectedCircle = null;
  }
}

document.getElementById("close-details").addEventListener("click", closePanel);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });

function showPanel(circle, d) {
  if (selectedCircle) selectedCircle.attr("stroke", "#fff").attr("stroke-width", 2);
  selectedCircle = circle.attr("stroke", "#222").attr("stroke-width", 3);

  panelContent.innerHTML =
    `<h2>${escapeHTML(d.peer)}</h2>` +
    `<p><strong>Persona:</strong> ${escapeHTML(d.persona)} (tier ${escapeHTML(d.tier_rank)})</p>` +
    `<p><strong>Quadrant:</strong> ${escapeHTML(d.quadrant)}</p>` +
    breakdownHTML("Impact", weights.impact, d, 1, d.impact_raw, d.impact) +
    breakdownHTML("Effort", weights.effort, d, -1, d.effort_raw, d.effort) +
    `<p class="note">Effort: a +1 score lowers effort, since that tie makes the donor easier to land.</p>` +
    `<h3>All criterion scores</h3><ul>` +
    SCORE_FIELDS.map(f =>
      `<li>${escapeHTML(f.label)}: ${escapeHTML(d[f.key])}</li>`
    ).join("") +
    `</ul><p><strong>Spreadsheet total score:</strong> ${escapeHTML(d.total_score)}</p>`;

  panel.hidden = false;
}

// One axis's math: score x weight for each criterion, the raw sum, and the plotted value.
// sign is 1 for impact and -1 for effort (a positive score lowers effort).
function breakdownHTML(title, axis, d, sign, raw, plotted) {
  const rows = axis.weights.map(w => {
    const score = d[w.key];
    const contribution = sign * score * w.weight;
    return `<tr><td>${escapeHTML(w.label)}</td><td>${score}</td>` +
      `<td>&times;${w.weight}</td><td>${signed(contribution)}</td></tr>`;
  }).join("");
  return `<h3>${title}: ${plotted} on the chart</h3>` +
    `<table class="breakdown"><tr><th>Criterion</th><th>Score</th><th>Weight</th><th>Adds</th></tr>` +
    rows +
    `<tr class="total"><td colspan="3">Raw total (out of &plusmn;${axis.max})</td><td>${signed(raw)}</td></tr>` +
    `</table>` +
    `<p class="note">${signed(raw)} &divide; ${axis.max} &times; ${weights.scale_to} = ${plotted}</p>`;
}

function signed(v) {
  const n = Math.round(v * 100) / 100 || 0;
  return (n > 0 ? "+" : "") + n;
}

// Escape HTML before inserting data into the detail panel.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

// ---------- Load data and draw points ----------
// js/config.js sets ENDPOINT to the Apps Script web app URL. With no ENDPOINT,
// the page shows data/sample.json so it can be tried without the spreadsheet.
const SAMPLE_PATH = "data/sample.json";
const statusText = document.getElementById("data-status");
const refreshButton = document.getElementById("refresh-data");
const errorBox = document.getElementById("data-error");
const warningsBox = document.getElementById("data-warnings");

function dataUrl() {
  const { ENDPOINT = "", KEY = "" } = window.CHART_CONFIG || {};
  if (!ENDPOINT) return SAMPLE_PATH;
  return ENDPOINT + (KEY ? `?key=${encodeURIComponent(KEY)}` : "");
}

function loadData() {
  refreshButton.disabled = true;
  statusText.textContent = "Loading donor data from the spreadsheet...";
  errorBox.hidden = true;

  d3.json(dataUrl(), { cache: "no-store" })
    .then(result => {
      if (result.error) throw new Error(result.error);
      weights = result.weights;
      drawPoints(result.donors);
      showStatus(result);
    })
    .catch(err => {
      console.error("Could not load chart data:", err);
      statusText.textContent = "";
      errorBox.textContent = `Could not load the donor data: ${err.message.replace(/\.$/, "")}. ` +
        "Check the endpoint URL in js/config.js and the Apps Script deployment (see docs/DEPLOYMENT.md).";
      errorBox.hidden = false;
    })
    .finally(() => { refreshButton.disabled = false; });
}

// "8 donors, live from the spreadsheet, as of Nov 25, 2026, 5:20 PM." plus any data warnings.
function showStatus(result) {
  const when = new Date(result.generated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const source = (window.CHART_CONFIG || {}).ENDPOINT
    ? "live from the spreadsheet"
    : "sample data (no endpoint set in js/config.js)";
  statusText.textContent = `${result.donors.length} donors, ${source}, as of ${when}.`;

  const warnings = result.warnings || [];
  warningsBox.hidden = warnings.length === 0;
  warningsBox.querySelector("summary").textContent =
    `${warnings.length} data warning${warnings.length === 1 ? "" : "s"} (check the spreadsheet)`;
  warningsBox.querySelector("ul").innerHTML =
    warnings.map(w => `<li>${escapeHTML(w)}</li>`).join("");
}

function drawPoints(donors) {
  closePanel();
  const data = donors.filter(d => Number.isFinite(d.impact) && Number.isFinite(d.effort));

  // Spread out donors that share the same (effort, impact) spot.
  d3.group(data, d => `${d.effort},${d.impact}`).forEach(group => {
    group.forEach((d, i) => {
      const r = group.length > 1 ? OVERLAP_SPREAD : 0;
      const angle = (2 * Math.PI * i) / group.length;
      d.plotX = d.effort + r * Math.cos(angle);
      d.plotY = d.impact + r * Math.sin(angle);
    });
  });

  svg.selectAll("circle.donor")
    .data(data, d => d.peer)
    .join("circle")
    .attr("class", "donor")
    .attr("cx", d => x(d.plotX))
    .attr("cy", d => y(d.plotY))
    .attr("r", 8)
    .attr("fill", "#4B8F78")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => tooltip.style("visibility", "visible").text(`${d.peer} (${d.persona})`))
    .on("mousemove", event => {
      tooltip
        .style("top", (event.pageY - 35) + "px")
        .style("left", (event.pageX + 12) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"))
    .on("click", function (event, d) {
      showPanel(d3.select(this), d);
    });
}

refreshButton.addEventListener("click", loadData);
loadData();
