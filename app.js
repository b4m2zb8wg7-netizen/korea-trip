/* Korea Family Trip Planner — vanilla JS, no build step.
   Data: activities.json | Saved state: localStorage */

const LS_BOOKMARKS = "koreaBookmarks"; // array of activity ids
const LS_CHECKED = "koreaBookingDone"; // array of activity ids ticked off

let activities = [];           // loaded from activities.json
let bookmarks = loadSet(LS_BOOKMARKS);
let checked = loadSet(LS_CHECKED);
let map = null;                // Leaflet map, created lazily
let mapMarkersDrawn = false;

// Active filters. Each is a Set of selected values; empty = no filter on that field.
const filters = {
  city: new Set(),
  forWhom: new Set(),
  status: new Set(),
  weatherProof: new Set(),
  indoor: new Set(),
  uniqueToKorea: new Set(),
  bookmarked: new Set()
};

// Friendly labels for the bookingLead enum.
const LEAD_TEXT = {
  "now": "Book weeks ahead",
  "few-days": "Book a few days ahead",
  "on-arrival": "Sort out on arrival",
  "none": ""
};
// Urgency order for sorting the booking checklist (lower = more urgent).
const LEAD_ORDER = { "now": 0, "few-days": 1, "on-arrival": 2, "none": 3 };

const STATUS_LABEL = { idea: "💡 idea", shortlisted: "📌 shortlisted", confirmed: "✅ confirmed" };

/* ---------- localStorage helpers ---------- */
function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key)) || []); }
  catch { return new Set(); }
}
function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

/* ---------- Boot ---------- */
async function init() {
  try {
    const res = await fetch("activities.json");
    const data = await res.json();
    // Supports either a plain array or the richer { activities: [...] } wrapper.
    activities = Array.isArray(data) ? data : (data.activities || []);
    if (!Array.isArray(data) && data.season) showSeasonNote(data.season);
  } catch (e) {
    document.getElementById("cards").innerHTML =
      "<p class='empty'>Couldn't load activities.json — make sure it's in the same folder.</p>";
    return;
  }
  wireTabs();
  wireFilters();
  wireRainy();
  renderList();
  renderChecklist();
}

function showSeasonNote(text) {
  const el = document.getElementById("seasonNote");
  if (el) { el.textContent = "🗓️ " + text; el.hidden = false; }
}

/* ---------- Filtering ---------- */
function rainyOn() { return document.getElementById("rainyToggle").checked; }

// forWhom may be an array (["kids","family"]) or, for older data, a single string.
function whoList(a) { return Array.isArray(a.forWhom) ? a.forWhom : [a.forWhom]; }

function passesFilters(a) {
  // Rainy day: only indoor OR weather-proof places
  if (rainyOn() && !(a.indoor || a.weatherProof)) return false;

  if (filters.city.size && !filters.city.has(a.city)) return false;
  if (filters.forWhom.size && !whoList(a).some(w => filters.forWhom.has(w))) return false;
  if (filters.status.size && !filters.status.has(a.status)) return false;
  if (filters.weatherProof.size && !a.weatherProof) return false;
  if (filters.indoor.size && !a.indoor) return false;
  if (filters.uniqueToKorea.size && !a.uniqueToKorea) return false;
  if (filters.bookmarked.size && !bookmarks.has(a.id)) return false;
  return true;
}

function anyFilterActive() {
  return Object.values(filters).some(s => s.size > 0);
}

/* ---------- List / Explore view ---------- */
function renderList() {
  const wrap = document.getElementById("cards");
  const shown = activities.filter(passesFilters);

  document.getElementById("emptyState").hidden = shown.length !== 0;
  document.getElementById("resultCount").textContent =
    `${shown.length} place${shown.length === 1 ? "" : "s"}` +
    (rainyOn() ? " · rainy-day picks" : "");

  wrap.innerHTML = shown.map(cardHTML).join("");

  // Bookmark toggles
  wrap.querySelectorAll(".bookmark-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleBookmark(btn.dataset.id));
  });
}

function cardHTML(a) {
  const on = bookmarks.has(a.id);
  const place = a.area ? `${escapeHTML(a.city)} · ${escapeHTML(a.area)}` : escapeHTML(a.city);

  const badges = [];
  if (a.weatherProof) badges.push(`<span class="badge wp">☂️ weather-proof</span>`);
  if (a.indoor) badges.push(`<span class="badge indoor">🏠 indoor</span>`);
  if (a.uniqueToKorea) badges.push(`<span class="badge korea">🇰🇷 only in Korea</span>`);
  whoList(a).forEach(w => badges.push(`<span class="badge who">${escapeHTML(w)}</span>`));
  (a.categories || []).forEach(c => badges.push(`<span class="badge">${escapeHTML(c)}</span>`));

  const statusBadge = a.status
    ? `<span class="status status-${escapeAttr(a.status)}">${STATUS_LABEL[a.status] || escapeHTML(a.status)}</span>`
    : "";

  const kids = a.kidsNote
    ? `<p class="kids-note">👦👧 ${escapeHTML(a.kidsNote)}</p>` : "";

  const lead = LEAD_TEXT[a.bookingLead] || "Booking required";
  const booking = a.needsBooking
    ? `<div class="booking-note"><b>📅 ${escapeHTML(lead)}.</b></div>` : "";

  return `
    <article class="card">
      <div class="card-top">
        <div>
          <h2 class="card-title">${escapeHTML(a.name)}</h2>
          <div class="card-city">${place}</div>
        </div>
        <button class="bookmark-btn ${on ? "on" : ""}" data-id="${escapeAttr(a.id)}"
                aria-label="Bookmark ${escapeAttr(a.name)}" aria-pressed="${on}">⭐</button>
      </div>
      ${statusBadge}
      <div class="badges">${badges.join("")}</div>
      ${a.notes ? `<p class="card-notes">${escapeHTML(a.notes)}</p>` : ""}
      ${kids}
      ${booking}
    </article>`;
}

function toggleBookmark(id) {
  if (bookmarks.has(id)) bookmarks.delete(id);
  else bookmarks.add(id);
  saveSet(LS_BOOKMARKS, bookmarks);
  renderList(); // refresh stars (and re-filter if "bookmarked" chip is active)
}

/* ---------- Booking checklist view ---------- */
function renderChecklist() {
  const wrap = document.getElementById("checklist");
  const items = activities.filter(a => a.needsBooking);

  if (!items.length) {
    wrap.innerHTML = "<p class='empty'>Nothing needs pre-booking. 🎉</p>";
    return;
  }

  // Ticked-off items sink to the bottom; within each group, most urgent first.
  items.sort((a, b) => {
    const d = Number(checked.has(a.id)) - Number(checked.has(b.id));
    if (d !== 0) return d;
    return (LEAD_ORDER[a.bookingLead] ?? 9) - (LEAD_ORDER[b.bookingLead] ?? 9);
  });

  wrap.innerHTML = items.map(a => {
    const done = checked.has(a.id);
    const lead = LEAD_TEXT[a.bookingLead] || "Booking required";
    const where = a.area ? `${escapeHTML(a.city)} · ${escapeHTML(a.area)}` : escapeHTML(a.city);
    const urgent = a.bookingLead === "now" ? " urgent" : "";
    return `
      <label class="check-item ${done ? "done" : ""}">
        <input type="checkbox" data-id="${escapeAttr(a.id)}" ${done ? "checked" : ""} />
        <div class="check-body">
          <span class="city-mini">${where}</span>
          <h3>${escapeHTML(a.name)}</h3>
          <p class="lead${urgent}">📅 ${escapeHTML(lead)}</p>
        </div>
      </label>`;
  }).join("");

  wrap.querySelectorAll("input[type=checkbox]").forEach(box => {
    box.addEventListener("change", () => {
      const id = box.dataset.id;
      if (box.checked) checked.add(id); else checked.delete(id);
      saveSet(LS_CHECKED, checked);
      renderChecklist();
    });
  });
}

/* ---------- Map view (Leaflet, lazy-loaded) ---------- */
function showMap() {
  if (map) { map.invalidateSize(); return; }
  loadLeaflet().then(() => {
    map = L.map("map").setView([36.5, 127.8], 7); // centre of South Korea
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);
    drawMarkers();
  }).catch(() => {
    document.getElementById("map").innerHTML =
      "<p class='empty'>Map needs an internet connection. Try again when you're online.</p>";
  });
}

function drawMarkers() {
  if (mapMarkersDrawn) return;
  let plotted = 0;
  activities.forEach(a => {
    if (typeof a.lat !== "number" || typeof a.lng !== "number") return;
    const star = bookmarks.has(a.id) ? "⭐ " : "";
    L.marker([a.lat, a.lng]).addTo(map).bindPopup(
      `<div class="map-popup"><b>${star}${escapeHTML(a.name)}</b><br><small>${escapeHTML(a.city)}${a.area ? " · " + escapeHTML(a.area) : ""}</small></div>`
    );
    plotted++;
  });
  mapMarkersDrawn = true;
  // Some entries have no coordinates yet — let the user know rather than silently hiding them.
  const missing = activities.length - plotted;
  if (missing > 0) {
    const note = document.getElementById("mapNote");
    if (note) {
      note.textContent = `Showing ${plotted} of ${activities.length} places. ${missing} don't have map coordinates yet — add lat/lng in activities.json to pin them.`;
      note.hidden = false;
    }
  }
}

// Inject Leaflet's script tag only when the map is first opened.
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve();
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ---------- Tabs ---------- */
function wireTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.dataset.view;

      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById(view + "View").classList.add("active");

      // Filters bar only makes sense on the Explore list
      document.getElementById("filters").style.display = view === "list" ? "" : "none";

      if (view === "map") showMap();
    });
  });
}

/* ---------- Filter chips ---------- */
function wireFilters() {
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const field = chip.dataset.filter;
      const value = chip.dataset.value;
      const set = filters[field];

      if (set.has(value)) { set.delete(value); chip.classList.remove("active"); }
      else { set.add(value); chip.classList.add("active"); }

      document.getElementById("clearFilters").hidden = !anyFilterActive();
      renderList();
    });
  });

  document.getElementById("clearFilters").addEventListener("click", () => {
    Object.values(filters).forEach(s => s.clear());
    document.querySelectorAll(".chip.active").forEach(c => c.classList.remove("active"));
    document.getElementById("clearFilters").hidden = true;
    renderList();
  });
}

/* ---------- Rainy-day toggle ---------- */
function wireRainy() {
  const t = document.getElementById("rainyToggle");
  t.addEventListener("change", () => {
    document.body.classList.toggle("rainy", t.checked);
    renderList();
  });
}

/* ---------- Tiny HTML-escaping helpers ---------- */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHTML(s); }

/* ---------- Service worker (offline) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(() => { document.getElementById("offlineDot").classList.add("ready"); })
      .catch(() => { /* offline just won't be available; app still works online */ });
  });
}

init();
