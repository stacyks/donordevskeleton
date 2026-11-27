// ---------- Configuration ----------
// The data source (the Apps Script web app URL) is set in js/config.js.
// The data arrives already weighted and rescaled by apps-script/Code.gs.

// Quadrant colors and short names. Code.gs labels every donor with one of these.
const QUADRANTS = {
  "Quick Win":             { color: "#2e8b62", short: "Quick Win" },
  "Strategic Investment":  { color: "#2f6db5", short: "Strategic" },
  "Low Priority":          { color: "#8a939c", short: "Low Priority" },
  "Reconsider Investment": { color: "#c9850f", short: "Reconsider" },
  "On a dividing line":    { color: "#a3a9b0", short: "Borderline" }
};

// Order of the Priority Order list. Within a quadrant, higher impact ranks first.
const PRIORITY_ORDER = ["Quick Win", "Strategic Investment", "On a dividing line", "Low Priority", "Reconsider Investment"];

// Criteria shown in the profile card, in this order.
const SCORE_FIELDS = [
  { key: "historical_giving", label: "Historical giving" },
  { key: "free_market", label: "Free market alignment" },
  { key: "esc_affiliation", label: "ESC affiliation" },
  { key: "warm_connections", label: "Warm connections" },
  { key: "umd_affiliation", label: "UMD affiliation" }
];

// Code.gs places donors between -5 and 5 on both axes. The chart shows a bit more
// so edge points have room, with extra space at the top for the quadrant labels.
const X_DOMAIN = [-6, 6];
const Y_DOMAIN = [-6, 6.6];

// Donors with identical scores would sit on top of each other,
// so they are spread in a small circle this many axis units wide.
const OVERLAP_SPREAD = 0.22;

const POINT_RADIUS = 8;
const ACTIVE_RADIUS = 10;

const margin = { top: 24, right: 24, bottom: 40, left: 40 };
const width = 860;
const height = 560;

// ---------- SVG + scales ----------
const svg = d3.select("#donor-chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const x = d3.scaleLinear().domain(X_DOMAIN).range([margin.left, width - margin.right]);
const y = d3.scaleLinear().domain(Y_DOMAIN).range([height - margin.bottom, margin.top]);

// Quadrant backgrounds and labels
const quadrantAreas = [
  { key: "Quick Win", label: "QUICK WINS", x0: X_DOMAIN[0], x1: 0, y0: 0, y1: Y_DOMAIN[1],
    lx: margin.left + 12, ly: margin.top + 22, anchor: "start" },
  { key: "Strategic Investment", label: "STRATEGIC INVESTMENTS", x0: 0, x1: X_DOMAIN[1], y0: 0, y1: Y_DOMAIN[1],
    lx: width - margin.right - 12, ly: margin.top + 22, anchor: "end" },
  { key: "Low Priority", label: "LOW PRIORITY", x0: X_DOMAIN[0], x1: 0, y0: Y_DOMAIN[0], y1: 0,
    lx: margin.left + 12, ly: height - margin.bottom - 12, anchor: "start" },
  { key: "Reconsider Investment", label: "RECONSIDER", x0: 0, x1: X_DOMAIN[1], y0: Y_DOMAIN[0], y1: 0,
    lx: width - margin.right - 12, ly: height - margin.bottom - 12, anchor: "end" }
];

svg.selectAll(".quadrant-bg")
  .data(quadrantAreas)
  .join("rect")
  .attr("class", "quadrant-bg")
  .attr("x", d => x(d.x0))
  .attr("y", d => y(d.y1))
  .attr("width", d => x(d.x1) - x(d.x0))
  .attr("height", d => y(d.y0) - y(d.y1))
  .attr("fill", d => QUADRANTS[d.key].color)
  .attr("fill-opacity", 0.08);

// White dividing lines between the quadrants
svg.append("line")
  .attr("x1", x(0)).attr("x2", x(0))
  .attr("y1", margin.top).attr("y2", height - margin.bottom)
  .attr("stroke", "#fff").attr("stroke-width", 3);

svg.append("line")
  .attr("x1", margin.left).attr("x2", width - margin.right)
  .attr("y1", y(0)).attr("y2", y(0))
  .attr("stroke", "#fff").attr("stroke-width", 3);

svg.selectAll(".quadrant-label")
  .data(quadrantAreas)
  .join("text")
  .attr("class", "quadrant-label")
  .attr("x", d => d.lx)
  .attr("y", d => d.ly)
  .attr("text-anchor", d => d.anchor)
  .attr("fill", d => QUADRANTS[d.key].color)
  .attr("font-size", 11)
  .attr("font-weight", 700)
  .attr("letter-spacing", "0.08em")
  .text(d => d.label);

// Axis labels in words instead of numbers
const axisText = (attrs, text) => {
  const t = svg.append("text").attr("fill", "#6b7280").attr("font-size", 12).text(text);
  Object.entries(attrs).forEach(([k, v]) => t.attr(k, v));
};
axisText({ x: margin.left, y: height - 12 }, "← Lower effort");
axisText({ x: width - margin.right, y: height - 12, "text-anchor": "end" }, "Higher effort →");
axisText({ transform: `translate(16,${height - margin.bottom}) rotate(-90)` }, "← Lower impact");
axisText({ transform: `translate(16,${margin.top}) rotate(-90)`, "text-anchor": "end" }, "Higher impact →");

const pointLayer = svg.append("g");

// ---------- Donor profile card ----------
// Hovering a point or a list row previews a donor's profile beside the point.
// Clicking pins it open until the x button, Esc, or a click on empty chart space.
const chartCard = document.querySelector(".chart-card");
const profile = document.getElementById("donor-profile");
let pinned = null; // name of the pinned donor, or null
let donorsByName = new Map();

function showProfile(name) {
  const d = donorsByName.get(name);
  if (!d) return;
  const q = QUADRANTS[d.quadrant] || QUADRANTS["On a dividing line"];

  profile.style.setProperty("--c", q.color);
  profile.classList.toggle("pinned", pinned === name);
  profile.innerHTML =
    `<button type="button" class="profile-close" aria-label="Close">&times;</button>` +
    `<h2>${escapeHTML(d.peer)}</h2>` +
    `<div class="tags"><span class="pill">${escapeHTML(q.short)}</span>` +
    `<span class="persona">${escapeHTML(d.persona)}</span></div>` +
    `<ul class="scores">` +
    SCORE_FIELDS.map(f => `<li><span>${escapeHTML(f.label)}</span>${meterHTML(d[f.key])}</li>`).join("") +
    `</ul>` +
    `<div class="legend">` +
    `<span><i class="neg"></i>Negative</span><span><i class="neu"></i>Neutral</span><span><i class="pos"></i>Positive</span>` +
    `</div>`;
  profile.hidden = false;

  highlight(name);
  placeProfile(name);
}

// Three squares for -1, 0, 1 with the donor's score lit up.
function meterHTML(score) {
  const word = score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";
  return `<span class="meter" title="${word}">` +
    `<i class="neg${score < 0 ? " on" : ""}"></i>` +
    `<i class="neu${score === 0 ? " on" : ""}"></i>` +
    `<i class="pos${score > 0 ? " on" : ""}"></i></span>`;
}

// Put the card to the right of the point, or to the left if it would run off the card.
function placeProfile(name) {
  const node = pointLayer.selectAll("circle.donor").filter(d => d.peer === name).node();
  if (!node) return;
  const card = chartCard.getBoundingClientRect();
  const pt = node.getBoundingClientRect();
  const cx = pt.left + pt.width / 2 - card.left;
  const cy = pt.top + pt.height / 2 - card.top;
  const w = profile.offsetWidth;
  const h = profile.offsetHeight;

  let left = cx + 20;
  if (left + w > card.width - 8) left = cx - 20 - w;
  left = Math.max(8, left);
  const top = Math.max(8, Math.min(cy - 30, card.height - h - 8));

  profile.style.left = `${left}px`;
  profile.style.top = `${top}px`;
}

function hideProfile() {
  if (pinned) return showProfile(pinned);
  profile.hidden = true;
  highlight(null);
}

function pin(name) {
  pinned = pinned === name ? null : name;
  if (pinned) showProfile(pinned);
  else hideProfile();
}

function unpin() {
  pinned = null;
  hideProfile();
}

// Outline the active point and shade its row in the Priority Order list.
function highlight(name) {
  pointLayer.selectAll("circle.donor")
    .classed("active", d => d.peer === name)
    .attr("r", d => d.peer === name ? ACTIVE_RADIUS : POINT_RADIUS)
    .filter(d => d.peer === name)
    .raise();
  d3.select("#priority-list").selectAll("li").classed("active", d => d.peer === name);
}

profile.addEventListener("click", e => { if (e.target.closest(".profile-close")) unpin(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") unpin(); });
svg.on("click", e => { if (!e.target.classList.contains("donor")) unpin(); });
window.addEventListener("resize", () => { if (!profile.hidden && pinned) placeProfile(pinned); });

// Escape HTML before inserting data into the page.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

// ---------- Load data and draw everything ----------
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
      const donors = result.donors.filter(d => Number.isFinite(d.impact) && Number.isFinite(d.effort));
      donorsByName = new Map(donors.map(d => [d.peer, d]));
      pinned = null;
      profile.hidden = true;
      drawPoints(donors);
      drawPriorityList(donors);
      drawCounts(donors);
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
  // Spread out donors that share the same (effort, impact) spot.
  d3.group(donors, d => `${d.effort},${d.impact}`).forEach(group => {
    group.forEach((d, i) => {
      const r = group.length > 1 ? OVERLAP_SPREAD : 0;
      const angle = (2 * Math.PI * i) / group.length;
      d.plotX = d.effort + r * Math.cos(angle);
      d.plotY = d.impact + r * Math.sin(angle);
    });
  });

  pointLayer.selectAll("circle.donor")
    .data(donors, d => d.peer)
    .join("circle")
    .attr("class", "donor")
    .attr("cx", d => x(d.plotX))
    .attr("cy", d => y(d.plotY))
    .attr("r", POINT_RADIUS)
    .attr("fill", d => (QUADRANTS[d.quadrant] || QUADRANTS["On a dividing line"]).color)
    .on("mouseenter", (event, d) => showProfile(d.peer))
    .on("mouseleave", hideProfile)
    .on("click", (event, d) => { event.stopPropagation(); pin(d.peer); });
}

function drawPriorityList(donors) {
  const rankOf = q => {
    const i = PRIORITY_ORDER.indexOf(q);
    return i < 0 ? PRIORITY_ORDER.length : i;
  };
  const sorted = donors.slice().sort((a, b) =>
    rankOf(a.quadrant) - rankOf(b.quadrant) || b.impact - a.impact || a.effort - b.effort);

  d3.select("#priority-list")
    .selectAll("li")
    .data(sorted, d => d.peer)
    .join("li")
    .attr("tabindex", 0)
    .html((d, i) => {
      const q = QUADRANTS[d.quadrant] || QUADRANTS["On a dividing line"];
      return `<span class="rank">${i + 1}</span>` +
        `<span class="dot" style="background:${q.color}"></span>` +
        `<span class="who"><b>${escapeHTML(d.peer)}</b>` +
        `<small>${escapeHTML(d.persona)} · ${escapeHTML(q.short)}</small></span>`;
    })
    .on("mouseenter focus", (event, d) => showProfile(d.peer))
    .on("mouseleave blur", hideProfile)
    .on("click", (event, d) => pin(d.peer))
    .on("keydown", (event, d) => { if (event.key === "Enter") pin(d.peer); });
}

// Count chips at the top. Borderline only appears when some donor is on a dividing line.
function drawCounts(donors) {
  const counts = d3.rollup(donors, v => v.length, d => d.quadrant);
  const shown = Object.keys(QUADRANTS).filter(q => q !== "On a dividing line" || counts.get(q));

  d3.select("#quadrant-counts")
    .selectAll("div")
    .data(shown)
    .join("div")
    .attr("class", "chip")
    .style("--c", q => QUADRANTS[q].color)
    .html(q => `<span class="dot"></span>${QUADRANTS[q].short} <b>${counts.get(q) || 0}</b>`);
}

refreshButton.addEventListener("click", loadData);
loadData();
