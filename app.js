/* Korea Family Trip Planner — vanilla JS, no build step.
   Data: activities.json | Saved state: localStorage */

const LS_BOOKMARKS = "koreaBookmarks"; // array of activity ids
const LS_CHECKED = "koreaBookingDone"; // array of activity ids ticked off
const LS_ITIN = "koreaItinerary";      // { startDate, days:[{id,note}], plan:{activityId:{dayId,slot,note}} }

let activities = [];           // loaded from activities.json
let bookmarks = loadSet(LS_BOOKMARKS);
let checked = loadSet(LS_CHECKED);
let itinerary = loadItinerary();
let map = null;                // Leaflet map, created lazily
let mapMarkersDrawn = false;

// Accommodation bookings — hardcoded reference data, no localStorage needed.
const STAYS = [
  { name: "ENA Suite Hotel Namdaemun", city: "Seoul", area: "Namdaemun",
    address: "36 Sejong-daero 11-gil, Jung-gu, Seoul",
    checkIn: "2025-06-27", checkOut: "2025-07-02", lat: 37.5634, lng: 126.9752,
    note: "Luggage stays here while in Busan 30 Jun–2 Jul." },
  { name: "Ocean The Point Hotel Busan", city: "Busan", area: "Gwangalli",
    address: "42 Gwanganhaebyeon-ro 278beon-gil, Suyeong-gu, Busan",
    checkIn: "2025-06-30", checkOut: "2025-07-02", lat: 35.1530, lng: 129.1186,
    note: "Busan side-trip — main bags left at ENA." },
  { name: "Gudo Collective Gangnam", city: "Seoul", area: "Gangnam",
    address: "11-3 Teheran-ro 8-gil, Gangnam-gu, Seoul",
    checkIn: "2025-07-02", checkOut: "2025-07-09", lat: 37.4981, lng: 127.0289, note: "" },
  { name: "Hotel The Designers Seoul Station", city: "Seoul", area: "Yongsan",
    address: "305 Hangang-daero, Namyeong-dong, Yongsan-gu, Seoul",
    checkIn: "2025-07-09", checkOut: "2025-07-15", lat: 37.5436, lng: 126.9709,
    note: "Raymond + Jacob fly home 9 Jul; Denise + Celine stay to 15 Jul." }
];

// Phrase book data — grouped by situation.
const PHRASES = [
  { group: "Essentials", icon: "💬", items: [
    { en: "Hello", rom: "an-nyeong-ha-se-yo", ko: "안녕하세요" },
    { en: "Thank you", rom: "gam-sa-ham-ni-da", ko: "감사합니다" },
    { en: "Yes / No", rom: "ne / a-ni-yo", ko: "네 / 아니요" },
    { en: "Excuse me (to get attention)", rom: "jeo-gi-yo", ko: "저기요" },
    { en: "Sorry", rom: "joe-song-ham-ni-da", ko: "죄송합니다" },
    { en: "Do you speak English?", rom: "yeong-eo-ha-se-yo?", ko: "영어하세요?" },
    { en: "I don't understand", rom: "mo-reu-ge-sseo-yo", ko: "모르겠어요" },
    { en: "How much is it?", rom: "eol-ma-ye-yo?", ko: "얼마예요?" }
  ]},
  { group: "Restaurant", icon: "🍜", items: [
    { en: "A table for four, please", rom: "ne-myeong-i-yo", ko: "네 명이요" },
    { en: "Menu, please", rom: "me-nyu ju-se-yo", ko: "메뉴 주세요" },
    { en: "This one, please (pointing)", rom: "i-geo ju-se-yo", ko: "이거 주세요" },
    { en: "Not spicy, please", rom: "an-mae-un-geo-ro ju-se-yo", ko: "안 매운 걸로 주세요" },
    { en: "Is this spicy?", rom: "i-geo mae-wo-yo?", ko: "이거 매워요?" },
    { en: "Water, please", rom: "mul ju-se-yo", ko: "물 주세요" },
    { en: "Fork, please (for kids)", rom: "po-keu ju-se-yo", ko: "포크 주세요" },
    { en: "Delicious!", rom: "ma-shi-sseo-yo", ko: "맛있어요" },
    { en: "Bill, please", rom: "gye-san-hae ju-se-yo", ko: "계산해 주세요" }
  ]},
  { group: "Transport", icon: "🚇", items: [
    { en: "Where is the subway station?", rom: "ji-ha-cheol-yeok eo-di-ye-yo?", ko: "지하철역 어디예요?" },
    { en: "How do I get to ___?", rom: "___ eo-tteo-ke ga-yo?", ko: "___ 어떻게 가요?" },
    { en: "One ticket, please", rom: "han-jang ju-se-yo", ko: "한 장 주세요" },
    { en: "Please stop here", rom: "yeo-gi-se se-wo ju-se-yo", ko: "여기서 세워 주세요" },
    { en: "Taxi", rom: "taek-si", ko: "택시" },
    { en: "Is this the train to Busan?", rom: "i-geo bu-san ga-yo?", ko: "이거 부산 가요?" }
  ]},
  { group: "Shopping", icon: "🛍️", items: [
    { en: "Can I try this on?", rom: "i-beo-bwa-do dwae-yo?", ko: "입어봐도 돼요?" },
    { en: "Bigger / smaller size?", rom: "deo keun / jak-eun sa-i-jeu i-sseo-yo?", ko: "더 큰 / 작은 사이즈 있어요?" },
    { en: "Can I pay by card?", rom: "ka-deu dwae-yo?", ko: "카드 돼요?" },
    { en: "Just looking, thanks", rom: "geu-nyang bo-neun geo-ye-yo", ko: "그냥 보는 거예요" },
    { en: "Too expensive", rom: "neo-mu bi-ssa-yo", ko: "너무 비싸요" }
  ]},
  { group: "Emergency & Kids", icon: "🆘", items: [
    { en: "Help!", rom: "do-wa-ju-se-yo", ko: "도와주세요" },
    { en: "Please call the police", rom: "gyeong-chal bul-leo ju-se-yo", ko: "경찰 불러 주세요" },
    { en: "I need a doctor", rom: "ui-sa-ga pi-ryo-hae-yo", ko: "의사가 필요해요" },
    { en: "My child is lost", rom: "a-i-reul i-reo-beo-ryeo-sseo-yo", ko: "아이를 잃어버렸어요" },
    { en: "Where is the toilet?", rom: "hwa-jang-sil eo-di-ye-yo?", ko: "화장실 어디예요?" },
    { en: "Where is the pharmacy?", rom: "yak-guk eo-di-ye-yo?", ko: "약국 어디예요?" }
  ]}
];

// Transport reference data — static, works offline.
const TRANSPORT = [
  { title: "Seoul ↔ Busan (KTX)", icon: "🚄", lines: [
    "Fastest train: ~2h 15m, Seoul Station → Busan Station.",
    "Cost: ~₩60,000 adult one-way (kids 4–12 ~50% off, under 4 free on lap).",
    "Book on the Korail app or at the station — reserve a few days ahead in peak season. Window seats on the left going south get coast views near Busan.",
    "Cheaper/slower option: ITX or Mugunghwa trains cost less but take 5h+."
  ]},
  { title: "Around Seoul", icon: "🚇", lines: [
    "Subway is the easiest way around — clean, signed in English, very kid-friendly.",
    "Get a T-money card (buy + top up at any convenience store or station machine). Tap in and out.",
    "Single rides ~₩1,400; children's T-money is discounted. Buses also accept T-money.",
    "Use Naver Map or KakaoMetro for routes — Google Maps directions are limited in Korea.",
    "Avoid rush hour (8–9 am, 6–7 pm) with the kids if you can."
  ]},
  { title: "Around Busan", icon: "🚈", lines: [
    "Busan has its own subway (4 lines) — your T-money card works here too.",
    "Single ride ~₩1,500. Buses cover beaches and hills the subway misses.",
    "Haeundae & Gwangalli beaches are on or near Line 2.",
    "The driverless Gimhae light rail links the airport to the subway."
  ]},
  { title: "Airport connections", icon: "✈️", lines: [
    "Incheon (ICN) → Seoul: AREX express ~43 min to Seoul Station, or all-stop ~58 min (cheaper). Airport limousine buses stop near major hotels.",
    "Gimpo (GMP) is closer to central Seoul and is on the subway.",
    "Gimhae (PUS) → Busan: Gimhae light rail to Sasang, then subway; or limousine bus / taxi (~30–40 min to city centre).",
    "Buy a T-money card at the airport convenience store before leaving — saves queuing later."
  ]}
];

// Weather city coordinates for Open-Meteo.
const WEATHER_CITIES = [
  { name: "Seoul", lat: 37.5665, lng: 126.9780 },
  { name: "Busan", lat: 35.1796, lng: 129.0756 }
];

// Time slots used by the day planner.
const SLOTS = [
  { key: "morning", label: "🌅 Morning", short: "AM" },
  { key: "afternoon", label: "☀️ Afternoon", short: "PM" },
  { key: "evening", label: "🌙 Evening", short: "Eve" }
];
function slotMeta(key) { return SLOTS.find(s => s.key === key) || SLOTS[0]; }

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
  markChanged();
}

function loadItinerary() {
  try {
    const obj = JSON.parse(localStorage.getItem(LS_ITIN)) || {};
    return { startDate: obj.startDate || "", days: obj.days || [], plan: obj.plan || {} };
  } catch { return { startDate: "", days: [], plan: {} }; }
}
function saveItinerary() {
  localStorage.setItem(LS_ITIN, JSON.stringify(itinerary));
  markChanged();
}
// The plan entry for an activity, or null if it isn't scheduled yet.
function getAssignment(id) { return itinerary.plan[id] || null; }
// 1-based position of a day in the trip, or 0 if the day no longer exists.
function dayNumber(dayId) { return itinerary.days.findIndex(d => d.id === dayId) + 1; }
// Short tag like "Day 3 · PM" for a scheduled activity.
function planTag(asg) {
  const n = dayNumber(asg.dayId);
  return `🗓️ Day ${n || "?"} · ${slotMeta(asg.slot).short}`;
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
  if (!itinerary.days.length) { addDay(false); } // start with one empty day
  if (!itinerary.startDate) { itinerary.startDate = "2025-06-27"; saveItinerary(); }
  wireTabs();
  wireFilters();
  wireRainy();
  wirePlanSheet();
  wireItineraryControls();
  wireSync();
  renderList();
  renderChecklist();
  renderItinerary();
  renderStaysSummary();
  renderPhrases();
  renderTransport();
  loadWeather();
  startSyncIfConfigured();
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
  // Plan buttons open the assign sheet
  wrap.querySelectorAll(".plan-btn").forEach(btn => {
    btn.addEventListener("click", () => openPlanSheet(btn.dataset.plan));
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

  const asg = getAssignment(a.id);
  const planBtn =
    `<button class="plan-btn ${asg ? "on" : ""}" data-plan="${escapeAttr(a.id)}">${asg ? planTag(asg) : "➕ Plan"}</button>`;

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
      ${planBtn}
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

/* ---------- Itinerary / day planner ---------- */
function addDay(rerender = true) {
  const id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  itinerary.days.push({ id, note: "" });
  saveItinerary();
  if (rerender) renderItinerary();
}

function removeDay(dayId) {
  itinerary.days = itinerary.days.filter(d => d.id !== dayId);
  // Drop any activities that were planned on the deleted day.
  Object.keys(itinerary.plan).forEach(id => {
    if (itinerary.plan[id].dayId === dayId) delete itinerary.plan[id];
  });
  saveItinerary();
  renderItinerary();
  renderList(); // plan tags on cards may have changed
}

function unassign(id) {
  delete itinerary.plan[id];
  saveItinerary();
  renderItinerary();
  renderList();
}

// "Mon 6 Jul" for the Nth day, if a trip start date is set; otherwise "".
function dayDateLabel(index) {
  if (!itinerary.startDate) return "";
  const [y, m, d] = itinerary.startDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d + index); // local midnight, no UTC shift
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function renderItinerary() {
  const startEl = document.getElementById("tripStart");
  if (startEl && startEl.value !== itinerary.startDate) startEl.value = itinerary.startDate;

  const wrap = document.getElementById("itinerary");
  if (!itinerary.days.length) {
    wrap.innerHTML = "<p class='empty'>No days yet. Tap “➕ Add day” to start.</p>";
    return;
  }

  wrap.innerHTML = itinerary.days.map((day, i) => {
    const dateLbl = dayDateLabel(i);
    const nightStays = staysOnNight(dayDate(i));
    const stayBadge = nightStays.length
      ? `<div class="day-stay">🏨 ${nightStays.map(s => escapeHTML(s.name)).join(" + ")}</div>`
      : "";
    const slots = SLOTS.map(slot => {
      const items = activities.filter(a => {
        const p = itinerary.plan[a.id];
        return p && p.dayId === day.id && p.slot === slot.key;
      });
      const rows = items.map(a => {
        const p = itinerary.plan[a.id];
        const noteLine = p.note ? `<span class="plan-item-note">📝 ${escapeHTML(p.note)}</span>` : "";
        return `
          <div class="plan-item">
            <button class="plan-item-main" data-edit="${escapeAttr(a.id)}">
              <span class="plan-item-name">${escapeHTML(a.name)}</span>
              <span class="plan-item-city">${escapeHTML(a.city)}${a.area ? " · " + escapeHTML(a.area) : ""}</span>
              ${noteLine}
            </button>
            <button class="plan-item-x" data-remove="${escapeAttr(a.id)}" aria-label="Remove ${escapeAttr(a.name)}">✕</button>
          </div>`;
      }).join("");
      return `
        <div class="slot">
          <div class="slot-label">${slot.label}</div>
          ${rows || "<p class='slot-empty'>—</p>"}
        </div>`;
    }).join("");

    return `
      <div class="day-card">
        <div class="day-head">
          <h3>Day ${i + 1}${dateLbl ? ` <span class="day-date">${dateLbl}</span>` : ""}</h3>
          <button class="day-remove" data-removeday="${escapeAttr(day.id)}" aria-label="Remove day ${i + 1}">🗑️</button>
        </div>
        ${stayBadge}
        <input class="day-note" data-daynote="${escapeAttr(day.id)}" value="${escapeAttr(day.note || "")}"
               placeholder="Day note / reminder (e.g. hotel checkout 11am)" />
        ${slots}
      </div>`;
  }).join("");

  wrap.querySelectorAll("[data-daynote]").forEach(inp => {
    inp.addEventListener("change", () => {
      const day = itinerary.days.find(d => d.id === inp.dataset.daynote);
      if (day) { day.note = inp.value; saveItinerary(); }
    });
  });
  wrap.querySelectorAll("[data-removeday]").forEach(btn => {
    btn.addEventListener("click", () => removeDay(btn.dataset.removeday));
  });
  wrap.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openPlanSheet(btn.dataset.edit));
  });
  wrap.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => unassign(btn.dataset.remove));
  });
}

function wireItineraryControls() {
  const start = document.getElementById("tripStart");
  start.value = itinerary.startDate;
  start.addEventListener("change", () => {
    itinerary.startDate = start.value;
    saveItinerary();
    renderItinerary();
  });
  document.getElementById("addDay").addEventListener("click", () => addDay(true));
}

/* ---------- Plan sheet (assign an activity to a day + slot) ---------- */
let planTarget = null;                          // activity id being planned
let planSel = { dayId: null, slot: "morning" }; // current picker selection

function openPlanSheet(id) {
  const a = activities.find(x => x.id === id);
  if (!a) return;
  if (!itinerary.days.length) addDay(false);

  planTarget = id;
  const existing = getAssignment(id);
  planSel = {
    dayId: existing ? existing.dayId : itinerary.days[0].id,
    slot: existing ? existing.slot : "morning"
  };
  // Guard against an assignment pointing at a day that was since deleted.
  if (!itinerary.days.some(d => d.id === planSel.dayId)) planSel.dayId = itinerary.days[0].id;

  document.getElementById("planSheetTitle").textContent = a.name;
  document.getElementById("planNote").value = existing ? (existing.note || "") : "";
  document.getElementById("planRemove").style.display = existing ? "" : "none";
  renderPlanSheetChoices();
  document.getElementById("planSheet").hidden = false;
}

function renderPlanSheetChoices() {
  const daysWrap = document.getElementById("planDays");
  daysWrap.innerHTML = itinerary.days.map((d, i) => {
    const lbl = dayDateLabel(i);
    return `<button type="button" class="day-pick ${d.id === planSel.dayId ? "sel" : ""}" data-day="${escapeAttr(d.id)}">Day ${i + 1}${lbl ? `<br><small>${lbl}</small>` : ""}</button>`;
  }).join("");
  daysWrap.querySelectorAll("[data-day]").forEach(b => {
    b.addEventListener("click", () => { planSel.dayId = b.dataset.day; renderPlanSheetChoices(); });
  });
  document.querySelectorAll("#planSlots button").forEach(b => {
    b.classList.toggle("sel", b.dataset.slot === planSel.slot);
  });
}

function wirePlanSheet() {
  document.querySelectorAll("#planSlots button").forEach(b => {
    b.addEventListener("click", () => { planSel.slot = b.dataset.slot; renderPlanSheetChoices(); });
  });
  document.getElementById("planSave").addEventListener("click", savePlan);
  document.getElementById("planRemove").addEventListener("click", () => {
    if (planTarget) unassign(planTarget);
    closePlanSheet();
  });
  document.getElementById("planCancel").addEventListener("click", closePlanSheet);
  document.getElementById("planSheet").addEventListener("click", e => {
    if (e.target.id === "planSheet") closePlanSheet(); // tap backdrop to dismiss
  });
}

function savePlan() {
  if (!planTarget) return;
  itinerary.plan[planTarget] = {
    dayId: planSel.dayId,
    slot: planSel.slot,
    note: document.getElementById("planNote").value.trim()
  };
  saveItinerary();
  closePlanSheet();
  renderList();
  renderItinerary();
}

function closePlanSheet() {
  planTarget = null;
  document.getElementById("planSheet").hidden = true;
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
  STAYS.forEach(s => {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
    L.circleMarker([s.lat, s.lng], {
      radius: 10,
      fillColor: "#e53e3e",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(map).bindPopup(
      `<div class="map-popup"><b>🏨 ${escapeHTML(s.name)}</b><br><small>${s.address ? escapeHTML(s.address) : escapeHTML(s.city)}</small></div>`
    );
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
      if (view === "itinerary") renderItinerary();
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

/* ---------- Phrase book ---------- */
function renderPhrases() {
  const wrap = document.getElementById("phraseGroups");
  if (!wrap) return;
  wrap.innerHTML = PHRASES.map((g, i) => `
    <details class="phrase-group" ${i === 0 ? "open" : ""}>
      <summary>${g.icon} ${escapeHTML(g.group)} <span class="phrase-count">${g.items.length}</span></summary>
      <div class="phrase-list">
        ${g.items.map(p => `
          <div class="phrase">
            <span class="phrase-en">${escapeHTML(p.en)}</span>
            <span class="phrase-ko">${escapeHTML(p.ko)}</span>
            <span class="phrase-rom">(${escapeHTML(p.rom)})</span>
          </div>`).join("")}
      </div>
    </details>`).join("");
}

/* ---------- Transport planner ---------- */
function renderTransport() {
  const wrap = document.getElementById("transportInfo");
  if (!wrap) return;
  wrap.innerHTML = TRANSPORT.map(t => `
    <div class="transport-card">
      <h3>${t.icon} ${escapeHTML(t.title)}</h3>
      <ul>${t.lines.map(l => `<li>${escapeHTML(l)}</li>`).join("")}</ul>
    </div>`).join("");
}

/* ---------- Weather widget ---------- */
function weatherInfo(code) {
  if (code === 0) return { icon: "☀️", label: "Clear" };
  if (code <= 3) return { icon: "⛅", label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 67) return { icon: "🌧️", label: "Rain", rain: true };
  if (code >= 71 && code <= 77) return { icon: "❄️", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", label: "Showers", rain: true };
  if (code >= 95) return { icon: "⛈️", label: "Storm", rain: true };
  return { icon: "🌡️", label: "—" };
}

async function loadWeather() {
  const strip = document.getElementById("weatherStrip");
  if (!strip || !navigator.onLine) return;
  try {
    const results = await Promise.all(WEATHER_CITIES.map(async c => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
                  `&current=temperature_2m,weathercode,precipitation` +
                  `&daily=temperature_2m_max,weathercode&forecast_days=2&timezone=Asia%2FSeoul`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const cur = data.current || {};
      const daily = data.daily || {};
      const tmrCode = daily.weathercode ? daily.weathercode[1] : null;
      const tmrTemp = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[1]) : null;
      return {
        name: c.name,
        temp: Math.round(cur.temperature_2m),
        info: weatherInfo(cur.weathercode),
        tmr: tmrCode != null ? { info: weatherInfo(tmrCode), temp: tmrTemp } : null
      };
    }));

    strip.innerHTML = `
      <div class="weather-row weather-today">
        ${results.map(r =>
          `<span class="weather-city"><b>${escapeHTML(r.name)}</b> ${r.info.icon} ${r.temp}°C <small>${escapeHTML(r.info.label)}</small></span>`
        ).join('<span class="weather-divider">·</span>')}
      </div>
      <div class="weather-row weather-tomorrow">
        <span class="weather-tmr-label">Tomorrow</span>
        ${results.map(r => r.tmr
          ? `<span class="weather-city weather-city--dim"><b>${escapeHTML(r.name)}</b> ${r.tmr.info.icon} ${r.tmr.temp}°C <small>${escapeHTML(r.tmr.info.label)}</small></span>`
          : ""
        ).join('<span class="weather-divider">·</span>')}
      </div>`;

    const raining = results.some(r => r.info.rain);
    if (raining && !rainyOn()) {
      strip.innerHTML += `<button class="weather-rainy-cta" id="weatherRainyCta">🌧️ Rain about — show rainy-day picks?</button>`;
      document.getElementById("weatherRainyCta").addEventListener("click", () => {
        const t = document.getElementById("rainyToggle");
        t.checked = true;
        t.dispatchEvent(new Event("change"));
      });
    }
    strip.hidden = false;
  } catch {
    strip.hidden = true;
  }
}

/* ---------- Accommodation helpers ---------- */
function parseYMD(str) {
  const [y, m, d] = (str || "").split("-").map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
}

function dayDate(index) {
  const start = parseYMD(itinerary.startDate);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
}

function staysOnNight(date) {
  if (!date) return [];
  return STAYS.filter(s => {
    const ci = parseYMD(s.checkIn), co = parseYMD(s.checkOut);
    return ci && co && date >= ci && date < co;
  });
}

function renderStaysSummary() {
  const wrap = document.getElementById("staysSummary");
  if (!wrap) return;
  const fmt = ymd => {
    const d = parseYMD(ymd);
    return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ymd;
  };
  wrap.innerHTML = `<h3 class="stays-title">🏨 Where we're staying</h3>` +
    STAYS.map(s => `
      <div class="stay-row">
        <div class="stay-main">
          <span class="stay-name">${escapeHTML(s.name)}</span>
          <span class="stay-city">${escapeHTML(s.city)}${s.area ? " · " + escapeHTML(s.area) : ""}</span>
          ${s.address ? `<span class="stay-address">${escapeHTML(s.address)}</span>` : ""}
          ${s.note ? `<span class="stay-note">📝 ${escapeHTML(s.note)}</span>` : ""}
        </div>
        <span class="stay-dates">${fmt(s.checkIn)}–${fmt(s.checkOut)}</span>
      </div>`).join("");
}

/* ---------- Tiny HTML-escaping helpers ---------- */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHTML(s); }

/* ---------- Live sync across phones (optional Cloudflare Worker) ---------- */
const LS_SYNC_URL = "koreaSyncUrl";     // your Worker base URL
const LS_SYNC_CODE = "koreaSyncCode";   // the shared trip code (the "password")
const LS_SYNCED_CODE = "koreaSyncedCode"; // last code this device fully synced
const LS_VERSION = "koreaUpdatedAt";    // local last-change timestamp (ms)
const POLL_MS = 6000;                   // how often to check for the other phone's changes

let syncUrl = localStorage.getItem(LS_SYNC_URL) || "";
let syncCode = localStorage.getItem(LS_SYNC_CODE) || "";
let syncEnabled = false;
let applyingRemote = false;             // guard so applying a pull doesn't re-trigger a push
let localVersion = Number(localStorage.getItem(LS_VERSION) || 0);
let pushTimer = null;
let pollTimer = null;

// Called by saveSet()/saveItinerary() after every local change.
function markChanged() {
  if (applyingRemote) return;
  localVersion = Date.now();
  localStorage.setItem(LS_VERSION, String(localVersion));
  schedulePush();
}

function endpoint() {
  return syncUrl.replace(/\/+$/, "") + "/trip/" + encodeURIComponent(syncCode);
}
function snapshot() {
  return { bookmarks: [...bookmarks], checked: [...checked], itinerary, updatedAt: localVersion };
}

function schedulePush() {
  if (!syncEnabled) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushState, 1200); // debounce rapid edits
}

async function pushState() {
  if (!syncEnabled) return;
  try {
    setSyncStatus("syncing");
    await fetch(endpoint(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot())
    });
    setSyncStatus("ok");
  } catch { setSyncStatus("offline"); }
}

async function pullState() {
  if (!syncEnabled) return;
  try {
    const res = await fetch(endpoint(), { cache: "no-store" });
    const remote = await res.json();
    if (remote && typeof remote.updatedAt === "number" && remote.updatedAt > localVersion) {
      applyRemote(remote);
    }
    setSyncStatus("ok");
  } catch { setSyncStatus("offline"); }
}

function applyRemote(remote) {
  applyingRemote = true;
  bookmarks = new Set(remote.bookmarks || []);
  checked = new Set(remote.checked || []);
  const it = remote.itinerary || {};
  itinerary = { startDate: it.startDate || "", days: it.days || [], plan: it.plan || {} };
  localStorage.setItem(LS_BOOKMARKS, JSON.stringify([...bookmarks]));
  localStorage.setItem(LS_CHECKED, JSON.stringify([...checked]));
  localStorage.setItem(LS_ITIN, JSON.stringify(itinerary));
  localVersion = remote.updatedAt;
  localStorage.setItem(LS_VERSION, String(localVersion));
  applyingRemote = false;
  renderList();
  renderChecklist();
  renderItinerary();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { if (!document.hidden) pullState(); }, POLL_MS);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function connectSync() {
  if (!syncUrl || !syncCode) return;
  syncEnabled = true;
  localStorage.setItem(LS_SYNC_URL, syncUrl);
  localStorage.setItem(LS_SYNC_CODE, syncCode);
  setSyncStatus("syncing");

  const knownCode = localStorage.getItem(LS_SYNCED_CODE) === syncCode;
  let remote = null;
  try { remote = await (await fetch(endpoint(), { cache: "no-store" })).json(); } catch {}

  if (remote && typeof remote.updatedAt === "number") {
    // Adopt the shared plan when joining, unless this device has genuine newer offline edits.
    if (knownCode && localVersion > remote.updatedAt) await pushState();
    else applyRemote(remote);
  } else {
    await pushState(); // empty locker — seed it with our plan
  }

  localStorage.setItem(LS_SYNCED_CODE, syncCode);
  startPolling();
  updateSyncUI();
  setSyncStatus("ok");
}

function disconnectSync() {
  syncEnabled = false;
  stopPolling();
  syncCode = "";
  localStorage.removeItem(LS_SYNC_CODE); // keep the Worker URL; forget the shared code
  updateSyncUI();
  setSyncStatus("idle");
}

function startSyncIfConfigured() {
  if (syncUrl && syncCode) connectSync();
  else updateSyncUI();
}

// Catch up the moment the app comes back to the foreground or back online.
document.addEventListener("visibilitychange", () => { if (!document.hidden) pullState(); });
window.addEventListener("online", pullState);
window.addEventListener("online", loadWeather);

/* ----- Sync panel UI ----- */
function genCode() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // unambiguous chars
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return "korea-" + [...a].map(x => chars[x % chars.length]).join("");
}

function setSyncStatus(state) {
  const el = document.getElementById("syncState");
  if (!el) return;
  const labels = {
    idle: "🔌 Not synced",
    syncing: "🔄 Syncing…",
    ok: "🟢 Synced" + (syncCode ? " · " + syncCode : ""),
    offline: "🟠 Offline — will retry"
  };
  el.textContent = labels[state] || labels.idle;
}

function shareString() {
  try { return btoa(JSON.stringify({ url: syncUrl, code: syncCode })); } catch { return ""; }
}
function parseShare(str) {
  try { const o = JSON.parse(atob(str.trim())); if (o && o.url && o.code) return o; } catch {}
  return null;
}

function updateSyncUI() {
  const open = document.getElementById("syncOpen");
  if (open) open.textContent = syncEnabled ? "Manage" : "Set up sync";
  setSyncStatus(syncEnabled ? "ok" : "idle");

  const urlInput = document.getElementById("syncUrlInput");
  const codeInput = document.getElementById("syncCodeInput");
  if (urlInput) urlInput.value = syncUrl;
  if (codeInput) codeInput.value = syncCode;

  const out = document.getElementById("syncShareOut");
  const outWrap = document.getElementById("syncShareWrap");
  if (out && outWrap) {
    if (syncEnabled) { out.value = shareString(); outWrap.hidden = false; }
    else outWrap.hidden = true;
  }
  const disc = document.getElementById("syncDisconnect");
  if (disc) disc.style.display = syncEnabled ? "" : "none";
}

function openSyncSheet() { updateSyncUI(); document.getElementById("syncSheet").hidden = false; }
function closeSyncSheet() { document.getElementById("syncSheet").hidden = true; }

function wireSync() {
  document.getElementById("syncOpen").addEventListener("click", openSyncSheet);
  document.getElementById("syncCancel").addEventListener("click", closeSyncSheet);
  document.getElementById("syncSheet").addEventListener("click", e => {
    if (e.target.id === "syncSheet") closeSyncSheet();
  });

  document.getElementById("syncGenerate").addEventListener("click", () => {
    document.getElementById("syncCodeInput").value = genCode();
  });

  document.getElementById("syncUseShare").addEventListener("click", () => {
    const parsed = parseShare(document.getElementById("syncShareIn").value);
    if (!parsed) { alert("That share code didn't work — copy it again from the other phone."); return; }
    document.getElementById("syncUrlInput").value = parsed.url;
    document.getElementById("syncCodeInput").value = parsed.code;
  });

  document.getElementById("syncConnect").addEventListener("click", async () => {
    const u = document.getElementById("syncUrlInput").value.trim();
    const c = document.getElementById("syncCodeInput").value.trim();
    if (!u) { alert("Paste your Cloudflare Worker URL first."); return; }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(c)) { alert("Enter a trip code (6+ letters/numbers), or tap Generate."); return; }
    syncUrl = u; syncCode = c;
    await connectSync();
    closeSyncSheet();
  });

  document.getElementById("syncDisconnect").addEventListener("click", disconnectSync);

  document.getElementById("syncCopyShare").addEventListener("click", async () => {
    const btn = document.getElementById("syncCopyShare");
    try { await navigator.clipboard.writeText(document.getElementById("syncShareOut").value); btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy", 1500); }
    catch { document.getElementById("syncShareOut").select(); }
  });
}

/* ---------- Service worker (offline) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(() => { document.getElementById("offlineDot").classList.add("ready"); })
      .catch(() => { /* offline just won't be available; app still works online */ });
  });
}

init();
