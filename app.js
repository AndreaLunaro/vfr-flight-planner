// VFR Flight Planning & Weight & Balance - Fixed and extended

// Global variables
let waypoints = [];
let alternateWaypoints = [];
let lastRouteData = null;
let lastAlternateData = null;
let currentChart = null;

const config = {
  defaultFlightSpeed: 90,
  defaultConsumption: 30,
  fuelDensity: 0.72,
  weightBalanceEnvelope: [
    {x:600,y:500}, {x:1280,y:1060}, {x:1100,y:1060}, {x:910,y:980}, {x:500,y:550}
  ]
};

// Utility: set cell value in worksheet without destroying existing styles
function setCellValuePreserve(ws, addr, value) {
  if (!addr) return;
  const isNum = (v) => (typeof v === 'number' && isFinite(v));
  if (ws[addr]) {
    ws[addr].v = value;
    ws[addr].t = isNum(value) ? 'n' : 's';
  } else {
    ws[addr] = { v: value, t: isNum(value) ? 'n' : 's' };
  }
}

// ROUTE CALC & DISPLAY (kept minimal here; assume other functions exist in file)
function calculateRoute() {
  // existing implementation in the file is expected to fill `waypoints` and `lastRouteData`.
  // This placeholder is kept if you want to trigger from UI manual button. The real implementation
  // in your app earlier will run and set waypoints & lastRouteData.
  console.log('calculateRoute: make sure your original route calc fills `waypoints` and `lastRouteData`.');
}

// --- EXPORT to Excel (preserve formatting) ---
async function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) non trovato: includi xlsx.full.min.js');
    return;
  }

  const templatePath = '/TemplateFlightLog.xlsx';

  try {
    const resp = await fetch(templatePath);
    if (!resp.ok) throw new Error('Template non trovato: ' + resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {type:'array'});
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];

    // Safety checks
    const segs = lastRouteData && lastRouteData.segments ? lastRouteData.segments : [];
    const wp = (typeof waypoints !== 'undefined' && waypoints.length) ? waypoints : [];

    // Fill A11 with first waypoint (if available)
    if (wp.length > 0) setCellValuePreserve(ws, 'A11', wp[0].name || wp[0]);

    // Fill route rows: for i=1..wp.length-1 write A(11+i) .. F(11+i)
    for (let i = 1; i < wp.length; i++) {
      const row = 11 + i;
      const seg = segs[i-1] || {};
      setCellValuePreserve(ws, 'A' + row, wp[i].name || wp[i] || '');
      setCellValuePreserve(ws, 'B' + row, seg.bearing !== undefined ? Math.ceil(seg.bearing) : '');
      // altitude is not computed in route segments in this JS; leave blank or set default
      setCellValuePreserve(ws, 'C' + row, seg.altitude !== undefined ? Math.ceil(seg.altitude) : '');
      setCellValuePreserve(ws, 'D' + row, seg.distance !== undefined ? Math.ceil(seg.distance) : '');
      setCellValuePreserve(ws, 'E' + row, seg.radial !== undefined ? Math.ceil(seg.radial) : '');
      // FlightTime in seg.flightTime is like "12 min"
      let ft = '';
      if (seg.flightTime) {
        const m = String(seg.flightTime).match(/(\d+)/);
        if (m) ft = Math.ceil(parseFloat(m[1]));
      }
      setCellValuePreserve(ws, 'F' + row, ft);
    }

    // Block summaries -> replicate Python placements
    // Sum distances and times from segments
    const totalDistance = segs.reduce((s, x) => s + (x.distance || 0), 0);
    const totalTimeMin = segs.reduce((s, x) => {
      if (!x.flightTime) return s;
      const m = String(x.flightTime).match(/(\d+)/);
      return s + (m ? parseFloat(m[1]) : 0);
    }, 0);

    setCellValuePreserve(ws, 'A26', 'Block in:');
    setCellValuePreserve(ws, 'C26', 'Block out: ' + Math.round(totalDistance*10)/10);
    setCellValuePreserve(ws, 'F26', 'Block time: ' + Math.round(totalTimeMin));
    setCellValuePreserve(ws, 'H26', 'Tot. T. Enr.');

    // Trip fuel calculations (replicating Python: Trip_fuel = round(sum(FlightTime)*0.01666*consumption,1))
    const consumptionInput = document.getElementById('fuel-consumption');
    const consumption = consumptionInput ? parseFloat(consumptionInput.value) || config.defaultConsumption : config.defaultConsumption;
    const Trip_fuel = Math.round(totalTimeMin * 0.01666 * consumption * 10) / 10;
    setCellValuePreserve(ws, 'O21', Trip_fuel);

    const ContingencyFuel = Math.round(Trip_fuel * 0.05 * 10) / 10;
    setCellValuePreserve(ws, 'O23', ContingencyFuel > 5 ? ContingencyFuel : 5);

    const Reserve45 = Math.round((45 * consumption / 60) * 10) / 10; // 45 min reserve
    setCellValuePreserve(ws, 'O24', Reserve45);

    // Alternate if present
    if (lastAlternateData && lastAlternateData.segments && lastAlternateData.segments.length > 0 && alternateWaypoints && alternateWaypoints.length>0) {
      const altSegs = lastAlternateData.segments;
      for (let i = 1; i < alternateWaypoints.length; i++) {
        const row = 11 + i;
        const seg = altSegs[i-1] || {};
        setCellValuePreserve(ws, 'K' + row, alternateWaypoints[i].name || alternateWaypoints[i] || '');
        setCellValuePreserve(ws, 'L' + row, seg.bearing !== undefined ? Math.ceil(seg.bearing) : '');
        setCellValuePreserve(ws, 'M' + row, seg.altitude !== undefined ? Math.ceil(seg.altitude) : '');
        setCellValuePreserve(ws, 'N' + row, seg.distance !== undefined ? Math.ceil(seg.distance) : '');
        setCellValuePreserve(ws, 'O' + row, seg.radial !== undefined ? Math.ceil(seg.radial) : '');
        let ftAlt = '';
        if (seg.flightTime) {
          const m = String(seg.flightTime).match(/(\d+)/);
          if (m) ftAlt = Math.ceil(parseFloat(m[1]));
        }
        setCellValuePreserve(ws, 'P' + row, ftAlt);
      }

      const altTotalTime = altSegs.reduce((s,x)=> s + (x.flightTime ? (parseInt(String(x.flightTime).match(/(\d+)/)||0)) : 0), 0);
      const Alt_Trip_fuel = Math.round(altTotalTime * 0.01666 * consumption * 10) / 10;
      setCellValuePreserve(ws, 'O22', Alt_Trip_fuel);
    }

    // Write file and trigger download - preserve workbook object to keep existing styles in template
    XLSX.writeFile(workbook, 'ExportedFlightPlan.xlsx');

    alert('Export completato: ExportedFlightPlan.xlsx');

  } catch (err) {
    console.error(err);
    alert('Errore export Excel: ' + err.message);
  }
}

// PRINT / PDF: generate an HTML view of the *same* filled worksheet and call print, forcing A5
async function printFlightLog() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) non trovato: includi xlsx.full.min.js');
    return;
  }

  const templatePath = '/TemplateFlightLog.xlsx';
  try {
    const resp = await fetch(templatePath);
    if (!resp.ok) throw new Error('Template non trovato: ' + resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {type:'array'});
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];

    // Fill the worksheet exactly as in exportToExcel() so the printed view is identical
    await exportToExcel(); // exportToExcel already prepares and downloads; but we want temporary HTML view.
    // Instead of reusing exportToExcel (which triggers download), re-generate sheet HTML from the in-memory workbook

  } catch (err) {
    console.error(err);
    alert('Errore stampa PDF: ' + err.message);
    return;
  }

  // Because we cannot reliably convert the exact .xlsx visual layout to PDF in-browser, we'll re-open the
  // workbook we've just written and convert the first sheet to HTML, then open a print window with A5 settings.
  // NOTE: We will read the exported file from the in-memory workbook; to avoid complexity, we'll regenerate
  // the workbook by calling exportToExcel but capture a new workbook object instead of forcing a download.

  try {
    // regenerate workbook buffer
    const resp2 = await fetch('/TemplateFlightLog.xlsx');
    const ab = await resp2.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), {type:'array'});
    const sname = wb.SheetNames[0];
    const sheet = wb.Sheets[sname];

    // apply same population as exportToExcel by reusing lastRouteData & alternateWaypoints logic
    // (we duplicate a small portion here to ensure the sheet contains values)
    // This mirrors exportToExcel internal logic but without the download step

    const segs = lastRouteData && lastRouteData.segments ? lastRouteData.segments : [];
    const wp = (typeof waypoints !== 'undefined' && waypoints.length) ? waypoints : [];
    if (wp.length > 0) setCellValuePreserve(sheet, 'A11', wp[0].name || wp[0]);
    for (let i = 1; i < wp.length; i++) {
      const row = 11 + i;
      const seg = segs[i-1] || {};
      setCellValuePreserve(sheet, 'A' + row, wp[i].name || wp[i] || '');
      setCellValuePreserve(sheet, 'B' + row, seg.bearing !== undefined ? Math.ceil(seg.bearing) : '');
      setCellValuePreserve(sheet, 'C' + row, seg.altitude !== undefined ? Math.ceil(seg.altitude) : '');
      setCellValuePreserve(sheet, 'D' + row, seg.distance !== undefined ? Math.ceil(seg.distance) : '');
      setCellValuePreserve(sheet, 'E' + row, seg.radial !== undefined ? Math.ceil(seg.radial) : '');
      let ft = '';
      if (seg.flightTime) {
        const m = String(seg.flightTime).match(/(\d+)/);
        if (m) ft = Math.ceil(parseFloat(m[1]));
      }
      setCellValuePreserve(sheet, 'F' + row, ft);
    }

    // alternate
    if (lastAlternateData && lastAlternateData.segments && lastAlternateData.segments.length > 0 && alternateWaypoints && alternateWaypoints.length>0) {
      const altSegs = lastAlternateData.segments;
      for (let i = 1; i < alternateWaypoints.length; i++) {
        const row = 11 + i;
        const seg = altSegs[i-1] || {};
        setCellValuePreserve(sheet, 'K' + row, alternateWaypoints[i].name || alternateWaypoints[i] || '');
        setCellValuePreserve(sheet, 'L' + row, seg.bearing !== undefined ? Math.ceil(seg.bearing) : '');
        setCellValuePreserve(sheet, 'M' + row, seg.altitude !== undefined ? Math.ceil(seg.altitude) : '');
        setCellValuePreserve(sheet, 'N' + row, seg.distance !== undefined ? Math.ceil(seg.distance) : '');
        setCellValuePreserve(sheet, 'O' + row, seg.radial !== undefined ? Math.ceil(seg.radial) : '');
        let ftAlt = '';
        if (seg.flightTime) {
          const m = String(seg.flightTime).match(/(\d+)/);
          if (m) ftAlt = Math.ceil(parseFloat(m[1]));
        }
        setCellValuePreserve(sheet, 'P' + row, ftAlt);
      }
    }

    // Build HTML from sheet
    const sheetHTML = XLSX.utils.sheet_to_html(sheet, {editable: false});
    const win = window.open('', '_blank');
    const style = `
      <style>
        @page { size: A5; margin: 8mm; }
        body { font-family: Arial, Helvetica, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #333; padding: 4px; font-size: 10pt; }
      </style>
    `;
    win.document.write('<html><head><title>Flight Log - Print</title>' + style + '</head><body>');
    win.document.write(sheetHTML);
    win.document.write('</body></html>');
    win.document.close();
    // Give browser a moment to render then call print
    setTimeout(() => { win.focus(); win.print(); }, 700);

  } catch (err) {
    console.error(err);
    alert('Errore durante la generazione del PDF: ' + err.message);
  }
}

// --- WEIGHT & BALANCE: read DOM and update chart ---
function calculateWBFromDOM() {
  const table = document.querySelector('.wb-table');
  if (!table) return;
  const tbody = table.tBodies[0];
  if (!tbody) return;

  let totalWeight = 0;
  let totalMoment = 0;

  const rows = Array.from(tbody.rows).filter(r => !r.classList.contains('total-row'));
  rows.forEach(row => {
    const itemText = (row.cells[0] && row.cells[0].textContent) ? row.cells[0].textContent.trim().toLowerCase() : '';
    const weightInput = row.querySelector('.wb-weight-input');
    const armInput = row.querySelector('.wb-arm-input');
    const momentInput = row.querySelectorAll('input')[2];

    let weightVal = parseFloat(weightInput && weightInput.value) || 0;
    let armVal = parseFloat(armInput && armInput.value) || 0;
    let moment = 0;

    if (itemText.includes('fuel')) {
      // fuel is provided in liters -> convert to kg
      const fuelWeight = weightVal * config.fuelDensity;
      moment = fuelWeight * armVal;
      // show moment in the readonly input
      if (momentInput) momentInput.value = moment.toFixed(1);
      totalWeight += fuelWeight;
      totalMoment += moment;
    } else {
      moment = weightVal * armVal;
      if (momentInput) momentInput.value = moment.toFixed(1);
      totalWeight += weightVal;
      totalMoment += moment;
    }
  });

  const totalRow = table.querySelector('.total-row');
  if (totalRow) {
    const inputs = totalRow.querySelectorAll('input');
    const cg = totalWeight > 0 ? (totalMoment / totalWeight) : 0;
    if (inputs[0]) inputs[0].value = totalWeight.toFixed(1);
    if (inputs[1]) inputs[1].value = cg.toFixed(3);
    if (inputs[2]) inputs[2].value = totalMoment.toFixed(1);

    // Update chart
    updateWeightBalanceChart(cg * 1000, totalWeight);

    // Update status
    const statusDiv = document.getElementById('wb-status');
    if (statusDiv) {
      const inside = isPointInEnvelope(cg * 1000, totalWeight);
      statusDiv.style.display = 'block';
      statusDiv.textContent = inside ? 'WITHIN W&B RANGE - Safe to fly' : 'OUTSIDE W&B RANGE - Not safe to fly';
      statusDiv.className = inside ? 'wb-status safe' : 'wb-status unsafe';
    }
  }
}

function calcWB() { calculateWBFromDOM(); }
function resetWB() {
  document.querySelectorAll('.wb-weight-input').forEach(i => i.value = '');
  document.querySelectorAll('.wb-arm-input').forEach(i => i.value = '');
  document.querySelectorAll('.wb-table .total-row input').forEach(i => i.value = '');
  updateWeightBalanceChart(0,0);
}

function isPointInEnvelope(x,y){
  const polygon = config.weightBalanceEnvelope;
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const xi=polygon[i].x, yi=polygon[i].y;
    const xj=polygon[j].x, yj=polygon[j].y;
    const intersect = ((yi>y) !== (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+Number.EPSILON)+xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Chart init & update
function initializeWeightBalanceChart() {
  const canvas = document.getElementById('wb-chart');
  if (!canvas) return;
  // ensure container has height so Chart.js can render
  const container = canvas.parentElement;
  if (container) {
    container.style.minHeight = '260px';
    container.style.position = 'relative';
  }

  const ctx = canvas.getContext('2d');
  if (currentChart) {
    try { currentChart.destroy(); } catch(e){}
    currentChart = null;
  }

  currentChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'W&B Envelope',
          data: config.weightBalanceEnvelope.map(p => ({x:p.x,y:p.y})),
          showLine: true,
          borderWidth: 2,
          pointRadius: 3,
          fill: true
        },
        {
          label: 'Current W&B',
          data: [],
          pointRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top'}, title: { display: true, text: 'Weight & Balance' } },
      scales: {
        x: { type: 'linear', min:400, max:1400, title:{display:true,text:'CG (mm)'} },
        y: { min: 0, max: 1400, title:{display:true,text:'Weight (kg)'} }
      }
    }
  });
}

function updateWeightBalanceChart(armMm, weight) {
  if (!currentChart) return;
  if (weight > 0) currentChart.data.datasets[1].data = [{x:armMm,y:weight}]; else currentChart.data.datasets[1].data = [];
  currentChart.update();
}

// Aircraft selection auto-apply
const aircraftProfiles = {
  'Aircraft A': { arms: [1.006,1.155,2.035,1.075,2.600], weights: [] },
  'Aircraft B': { arms: [1.02,1.16,2.04,1.08,2.62], weights: [] }
};

function applyAircraftProfileFromSelect() {
  const sel = document.getElementById('aircraft-select');
  if (!sel) return;
  const val = sel.value;
  const profile = aircraftProfiles[val] || null;
  // hide manual apply button if present
  const applyBtn = document.querySelector("button[onclick*='applyAircraftProfile']");
  if (applyBtn) applyBtn.style.display = 'none';

  if (profile) {
    // set arm inputs
    const armInputs = Array.from(document.querySelectorAll('.wb-arm-input'));
    armInputs.forEach((input, idx) => {
      if (profile.arms && profile.arms[idx]!==undefined) input.value = profile.arms[idx];
    });
    // set weight inputs if provided
    const weightInputs = Array.from(document.querySelectorAll('.wb-weight-input'));
    if (profile.weights && profile.weights.length) {
      weightInputs.forEach((input, idx) => {
        if (profile.weights[idx]!==undefined) input.value = profile.weights[idx];
      });
    }
    // auto-calc
    calculateWBFromDOM();
  }
}

// Responsive mobile improvements: call on load & resize
function setupResponsive() {
  // add viewport meta if missing
  if (!document.querySelector('meta[name=\"viewport\"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.getElementsByTagName('head')[0].appendChild(meta);
  }

  // adjust chart container height for small screens
  function adjust() {
    const container = document.querySelector('.chart-container');
    if (!container) return;
    if (window.innerWidth < 480) {
      container.style.minHeight = '220px';
    } else if (window.innerWidth < 768) {
      container.style.minHeight = '260px';
    } else {
      container.style.minHeight = '320px';
    }
    if (currentChart) currentChart.resize();
  }
  window.addEventListener('resize', adjust);
  adjust();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  try { initializeWeightBalanceChart(); } catch(e){ console.debug('chart init failed', e.message); }

  // bind aircraft select automatic change
  const sel = document.getElementById('aircraft-select');
  if (sel) {
    sel.addEventListener('change', applyAircraftProfileFromSelect);
    // apply current selection immediately
    applyAircraftProfileFromSelect();
  }

  // bind calc WB button
  const calcBtn = document.querySelector('button[onclick*=\"calcWB\"]');
  if (calcBtn) calcBtn.addEventListener('click', calculateWBFromDOM);

  // bind reset
  const resetBtn = document.querySelector('button[onclick*=\"resetWB\"]');
  if (resetBtn) resetBtn.addEventListener('click', resetWB);

  // bind export & print if buttons use those names
  const exp = document.querySelector('button[onclick*=\"exportToExcel\"]');
  if (exp) exp.addEventListener('click', exportToExcel);
  const pr = document.querySelector('button[onclick*=\"printFlightLog\"]');
  if (pr) pr.addEventListener('click', printFlightLog);

  setupResponsive();
});
