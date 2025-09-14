/* ====== Config & globals ====== */
const config = {
  defaultFlightSpeed: 90,
  defaultConsumption: 30,
  aircraftProfiles: {
    'Aircraft A': { arms: [1.006, 1.155, 2.035, 1.075, 2.6] },
    'Aircraft B': { arms: [1.000, 1.140, 2.000, 1.050, 2.550] }
  },
  wbEnvelope: [
    { x: 600, y: 500 },
    { x: 1280, y: 1060 },
    { x: 1100, y: 1060 },
    { x: 910, y: 980 },
    { x: 500, y: 550 }
  ],
  fuelDensity: 0.72
};

let waypoints = [],
  alternateRoute = [];
let latestTripData = null,
  latestAltData = null;
let currentChart = null;

/* ====== I18N ====== */
const i18n = {
  it: {
    title: 'Pianificazione VFR & Weight & Balance',
    lang: 'English',
    tab_flight: 'Pianificazione Volo',
    tab_wb: 'Weight & Balance',
    cruise_speed: 'Velocità [kts]',
    fuel_consumption: 'Consumo [L/h]',
    num_wpts: 'Numero Waypoints',
    gen_wpts: 'Genera Waypoints',
    include_alt: 'Includi Alternato',
    num_alt_wpts: 'Num Waypoints Alternato',
    gen_alt_wpts: 'Genera Alt Waypoints',
    calc: 'Calcola',
    export_xlsx: 'Export Excel',
    print_pdf: 'Stampa PDF',
    table_fix: 'FIX',
    table_route: 'Route',
    table_alt: 'Alt. [Ft]',
    table_dist: 'Dist. [NM]',
    table_radial: 'Radial',
    table_time: 'Flight Time [min]'
  },
  en: {
    title: 'VFR Flight Planning & Weight & Balance',
    lang: 'Italiano',
    tab_flight: 'Flight Planning',
    tab_wb: 'Weight & Balance',
    cruise_speed: 'Cruise Speed [kts]',
    fuel_consumption: 'Fuel Consumption [L/h]',
    num_wpts: 'Number of Waypoints',
    gen_wpts: 'Generate Waypoints',
    include_alt: 'Include Alternate',
    num_alt_wpts: 'Alternate Waypoints',
    gen_alt_wpts: 'Generate Alt Waypoints',
    calc: 'Calculate',
    export_xlsx: 'Export Excel',
    print_pdf: 'Print PDF',
    table_fix: 'FIX',
    table_route: 'Route',
    table_alt: 'Alt. [Ft]',
    table_dist: 'Dist. [NM]',
    table_radial: 'Radial',
    table_time: 'Flight Time [min]'
  }
};
let currentLang = 'it';
function applyI18n(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang][key]) {
      if (el.tagName === 'INPUT') el.placeholder = i18n[lang][key];
      else el.textContent = i18n[lang][key];
    }
  });
  currentLang = lang;
}
document.getElementById('lang-toggle').onclick = () => {
  applyI18n(currentLang === 'it' ? 'en' : 'it');
};
window.addEventListener('DOMContentLoaded', () => applyI18n('it'));

/* ====== Tab switching ====== */
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tabId === 'weight-balance' && !currentChart) setTimeout(initWBChart, 100);
}

/* ====== Dynamic waypoint inputs ====== */
function generateWaypoints() {
  const n = +document.getElementById('num-waypoints').value;
  if (n < 2 || n > 20) return alert('2-20');
  const box = document.getElementById('waypoints-container');
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="waypoint-input">
         <label class="form-label">${i === 0 ? 'Start' : 'WP ' + i}</label>
         <input class="form-control waypoint-name" />
       </div>`
    );
  }
  document.getElementById('waypoints-section').style.display = 'block';
}

/* ====== Alternate inputs ====== */
function toggleAlternate() {
  document.getElementById('alternate-section').style.display = document.getElementById('include-alternate').checked
    ? 'block'
    : 'none';
}
function generateAlternateWaypoints() {
  const n = +document.getElementById('num-alt-waypoints').value;
  if (n < 2 || n > 20) return alert('2-20');
  const box = document.getElementById('alt-waypoints-container');
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="waypoint-input">
         <label class="form-label">${i === 0 ? 'Alt Start' : 'Alt WP ' + i}</label>
         <input class="form-control alt-waypoint-name" />
       </div>`
    );
  }
}

/* ====== Geocoding helper ====== */
async function geocode(name) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`;
  const r = await fetch(url);
  const d = await r.json();
  if (!d.length) throw Error('geocode');
  return { lat: +d[0].lat, lon: +d[0].lon };
}

/* ====== Geometry helpers ====== */
const R = 3440.065; // NM
const toRad = deg => (deg * Math.PI) / 180;
const toDeg = rad => (rad * 180) / Math.PI;
function gcDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* ====== Main route calculation (Sostituita con versione migliorata) ====== */
async function calculateRoute() {
  const names = [...document.querySelectorAll('.waypoint-name')].map(e => e.value.trim()).filter(Boolean);
  if (names.length < 2) return alert('Inserire almeno due waypoint.');

  const coords = [];
  for (const n of names) coords.push(await geocode(n));
  waypoints = coords.map((c, i) => ({ name: names[i], ...c }));

  latestTripData = calcSegments(waypoints);
  renderTable(latestTripData, waypoints, 'flight-results-body', 'flight-results');

  // alternate
  latestAltData = null;
  if (document.getElementById('include-alternate').checked) {
    const altNames = [...document.querySelectorAll('.alt-waypoint-name')]
      .map(e => e.value.trim())
      .filter(Boolean);
    if (altNames.length >= 2) {
      const altCoords = [];
      for (const n of altNames) altCoords.push(await geocode(n));
      alternateRoute = altCoords.map((c, i) => ({ name: altNames[i], ...c }));
      latestAltData = calcSegments(alternateRoute);
    }
  }
}

function calcSegments(list) {
  const speed = +document.getElementById('cruise-speed').value || config.defaultFlightSpeed;
  const cons = +document.getElementById('fuel-consumption').value || config.defaultConsumption;
  const segments = [];
  let totDist = 0,
    totTime = 0;
  for (let i = 0; i < list.length - 1; i++) {
    const dist = gcDistance(list[i].lat, list[i].lon, list[i + 1].lat, list[i + 1].lon);
    const brg = bearing(list[i].lat, list[i].lon, list[i + 1].lat, list[i + 1].lon);
    const t = (dist / speed) * 60;
    segments.push({
      distance: dist,
      bearing: Math.round(brg),
      flightTime: Math.round(t),
      altitude: 3000 + i * 500
    });
    totDist += dist;
    totTime += t;
  }
  return {
    segments,
    totals: { distance: totDist, time: totTime, fuel: (totTime / 60) * cons }
  };
}

/* ====== Table render with 1-row offset ====== */
function renderTable(data, list, tbodyId, containerId) {
  const tb = document.getElementById(tbodyId);
  tb.innerHTML = '';
  tb.insertAdjacentHTML('beforeend', `<tr><td>${list[0].name}</td><td colspan="5"></td></tr>`);
  for (let i = 1; i < list.length; i++) {
    const seg = data.segments[i - 1];
    const radial = Math.round(bearing(list[i].lat, list[i].lon, list[0].lat, list[0].lon));
    tb.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td>${list[i].name}</td>
        <td>${seg.bearing}</td>
        <td>${seg.altitude}</td>
        <td>${Math.round(seg.distance)}</td>
        <td>${radial}</td>
        <td>${seg.flightTime}</td>
      </tr>`
    );
  }
  document.getElementById(containerId).style.display = 'block';
}

/* ====== Excel export (Aggiornata) ====== */
async function exportToExcel() {
  if (!latestTripData) return alert('Calcola prima');
  const resp = await fetch('TemplateFlightLog.xlsx');
  const ab = await resp.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Trip
  XLSX.utils.sheet_add_aoa(ws, [[waypoints[0].name]], { origin: 'A11' });
  for (let i = 1; i < waypoints.length; i++) {
    const r = 11 + i;
    const seg = latestTripData.segments[i - 1];
    const radial = Math.ceil(bearing(waypoints[i].lat, waypoints[i].lon, waypoints[0].lat, waypoints[0].lon));
    XLSX.utils.sheet_add_aoa(
      ws,
      [[
        waypoints[i].name.split(',')[0],
        Math.ceil(seg.bearing),
        Math.ceil(seg.altitude),
        Math.ceil(seg.distance),
        radial,
        Math.ceil(seg.flightTime)
      ]],
      { origin: 'A' + r }
    );
  }

  const totNM = Math.round(latestTripData.totals.distance * 10) / 10;
  const totMin = Math.round(latestTripData.totals.time * 10) / 10;
  const cons = +document.getElementById('fuel-consumption').value || config.defaultConsumption;
  const tripFuel = Math.round((latestTripData.totals.time / 60) * cons * 10) / 10;
  const contFuel = Math.max(5, Math.round(tripFuel * 0.05 * 10) / 10);
  const finalRes = Math.round((45 * cons) / 60 * 10) / 10;

  XLSX.utils.sheet_add_aoa(ws, [['Block in:']], { origin: 'A26' });
  XLSX.utils.sheet_add_aoa(ws, [[`Block out: ${totNM}`]], { origin: 'C26' });
  XLSX.utils.sheet_add_aoa(ws, [[`Block time: ${totMin}`]], { origin: 'F26' });
  XLSX.utils.sheet_add_aoa(ws, [['Tot. T. Enr.']], { origin: 'H26' });
  XLSX.utils.sheet_add_aoa(ws, [[tripFuel]], { origin: 'O21' });
  XLSX.utils.sheet_add_aoa(ws, [[contFuel]], { origin: 'O23' });
  XLSX.utils.sheet_add_aoa(ws, [[finalRes]], { origin: 'O24' });

  // Alternate
  if (latestAltData && alternateRoute.length > 0) {
    const altTripFuel = Math.round((latestAltData.totals.time / 60) * cons * 10) / 10;
    XLSX.utils.sheet_add_aoa(ws, [[altTripFuel]], { origin: 'O22' });
    for (let i = 1; i < alternateRoute.length; i++) {
      const r = 11 + i;
      const seg = latestAltData.segments[i - 1];
      const radial = Math.ceil(bearing(alternateRoute[i].lat, alternateRoute[i].lon, alternateRoute[0].lat, alternateRoute[0].lon));
      XLSX.utils.sheet_add_aoa(
        ws,
        [[
          alternateRoute[i].name.split(',')[0],
          Math.ceil(seg.bearing),
          Math.ceil(seg.altitude),
          Math.ceil(seg.distance),
          radial,
          Math.ceil(seg.flightTime)
        ]],
        { origin: 'K' + r }
      );
    }
  }

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ExportedFlightPlan.xlsx';
  a.click();
}

/* ====== PDF / print ====== */
function printFlightLog() {
  if (!latestTripData) return alert('Calcola prima');
  const win = window.open('', '_blank');
  const rows = document.getElementById('flight-results-body').innerHTML;
  let altHtml = '';
  if (latestAltData && alternateRoute.length) {
    const altRows = renderAltRowsHTML();
    altHtml = `<h2>Alternate</h2><table><thead>${document
      .querySelector('.results-table thead').innerHTML}</thead><tbody>${altRows}</tbody></table>`;
  }
  win.document.write(`
    <style>
      body{font-family:Arial;padding:16px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #999;padding:4px 6px;text-align:left}
    </style>
    <h2>Trip</h2>
    <table><thead>${document.querySelector('.results-table thead').innerHTML}</thead><tbody>${rows}</tbody></table>
    ${altHtml}
    <script>window.print();</script>
  `);
  win.document.close();
}
function renderAltRowsHTML() {
  const arr = [];
  arr.push(`<tr><td>${alternateRoute[0].name}</td><td colspan="5"></td></tr>`);
  for (let i = 1; i < alternateRoute.length; i++) {
    const seg = latestAltData.segments[i - 1];
    const radial = Math.round(bearing(alternateRoute[i].lat, alternateRoute[i].lon, alternateRoute[0].lat, alternateRoute[0].lon));
    arr.push(
      `<tr><td>${alternateRoute[i].name}</td><td>${seg.bearing}</td><td>${seg.altitude}</td><td>${Math.round(
        seg.distance
      )}</td><td>${radial}</td><td>${seg.flightTime}</td></tr>`
    );
  }
  return arr.join('');
}

/* ====== Weight & Balance ====== */
function applyAircraftProfile(name) {
  const arms = config.aircraftProfiles[name].arms;
  document.querySelectorAll('.wb-arm-input').forEach((el, i) => (el.value = arms[i].toFixed(3)));
}
function calcWB() {
  const rows = [...document.querySelectorAll('.wb-table tbody tr')].slice(0, 5);
  let totW = 0,
    totM = 0;
  rows.forEach((tr, i) => {
    const w = +tr.children[1].firstElementChild.value || 0;
    const arm = +tr.children[2].firstElementChild.value;
    const moment = i === 3 ? w * 0.72 * arm : w * arm;
    tr.children[3].firstElementChild.value = moment.toFixed(2);
    totW += i === 3 ? w * 0.72 : w;
    totM += moment;
  });
  const cg = totW ? totM / totW : 0;
  const totalRow = document.querySelector('.total-row');
  totalRow.children[1].firstElementChild.value = totW.toFixed(2);
  totalRow.children[2].firstElementChild.value = cg.toFixed(2);
  totalRow.children[3].firstElementChild.value = totM.toFixed(2);
  plotWB(totM, totW);
}
function reset
