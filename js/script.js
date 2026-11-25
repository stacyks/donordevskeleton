// ---------- Configuration ----------
//USE Apps Script Web App URL!!!!!!
const SHEET_API_URL = "https://google.com";

// CSV columns: a, b, c (nominal), impact, effort (quantitative)
// a = name shown in tooltip/panel title; b and c = detail sections in the side panel
const DETAIL_FIELDS = [
  { key: "rev_donor_bases", label: "Revenue & Donor Bases" },
  { key: "prospect_track", label: "Prospecting & Tracking" }
];

// Axes run from -AXIS_RANGE to +AXIS_RANGE, quadrants split at 0.
// Change these numbers if your scores use a different scale.
const AXIS_MIN = -5;
const AXIS_MAX = 5;
const MIDPOINT = 0;

const margin = { top: 30, right: 40, bottom: 65, left: 65 };
const width = 850;
const height = 600;

// ---------- SVG + scales ----------
const svg = d3.select("#donor-chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const x = d3.scaleLinear()
  .domain([AXIS_MIN, AXIS_MAX])
  .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
  .domain([AXIS_MIN, AXIS_MAX])
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
  .call(d3.axisBottom(x).ticks(AXIS_MAX - AXIS_MIN));

svg.append("g")
  .attr("transform", `translate(${margin.left},0)`)
  .call(d3.axisLeft(y).ticks(AXIS_MAX - AXIS_MIN));

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
    DETAIL_FIELDS.map(f =>
      `<h3>${escapeHTML(f.label)}</h3><p>${escapeHTML(d[f.key])}</p>`
    ).join("");

  panel.hidden = false;
}

// Escape HTML before inserting data into the detail panel.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}


// ---------- Load Google Sheet JSON and draw points ----------
d3.json(SHEET_API_URL)
  .then(rawData => {
    const data = rawData
      .map(d => ({
        peer: d.peer,
        rev_donor_bases: d.rev_donor_bases,
        prospect_track: d.prospect_track,
        impact: +d.impact,
        effort: +d.effort
      }))
      .filter(d => !isNaN(d.impact) && !isNaN(d.effort));

    svg.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.effort))
      .attr("cy", d => y(d.impact))
      .attr("r", 8)
      .attr("fill", "#4B8F78")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => tooltip.style("visibility", "visible").text(d.peer))
      .on("mousemove", event => {
        tooltip
          .style("top", (event.pageY - 35) + "px")
          .style("left", (event.pageX + 12) + "px");
      })
      .on("mouseout", () => tooltip.style("visibility", "hidden"))
      .on("click", function (event, d) {
        showPanel(d3.select(this), d);
      });
  })
  .catch(err => {
    console.error("Could not load Google Sheet data:", err);
    d3.select("#donor-chart")
      .append("p")
      .style("color", "crimson")
      .text("Could not load data from the Google Sheet. Check that the Apps Script deployment is set to 'Anyone'.");
  });
