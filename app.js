/* app.js - Full VFR planner + W&B
   - Waypoint generation / geocoding (Nominatim)
   - Route and alternate calculation & display
   - Export to Excel (attempt to preserve template formatting)
   - Print to PDF (A5) by converting sheet to HTML and calling print
   - Weight & Balance with Chart.js
   - Responsive tweaks
*/

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

// UI helpers
function showLoading(show) {
  const ld = document.getElementById('loading');
  if (ld) ld.style.display = show ? 'flex' : 'none';
}
function showError(msg) {
  const el = document.getElementById('error-message');
  if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(()=>el.style.display='none',5000); }
  else alert(msg);
}

// Waypoint UI
function clearContainer(containerId) {
  const c = document.getElementById(containerId);
  if (c) c.innerHTML = '';
}
function generateWaypoints() {
  const num = parseInt(document.getElementById('num-waypoints').value) || 0;
  if (num < 2) { showError('Inserire almeno 2 waypoints'); return; }
  const container = document.getElementById('waypoints-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i=0;i<num;i++) {
    const div = document.createElement('div'); div.className = 'wp-row';
    const input = document.createElement('input'); input.className = 'form-control waypoint-name';
    input.placeholder = i===0 ? 'Origin / Airfield' : (i===num-1 ? 'Destination / Airfield' : 'Waypoint');
    div.appendChild(input);
    container.appendChild(div);
  }
  document.getElementById('waypoints-section').style.display = 'block';
}
function generateAlternateWaypoints() {
  const num = parseInt(document.getElementById('num-alt-waypoints').value) || 0;
  if (num < 2) { showError('Inserire almeno 2 waypoints per alternato'); return; }
  const container = document.getElementById('alt-waypoints-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i=0;i<num;i++) {
    const div = document.createElement('div'); div.className = 'wp-row';
    const input = document.createElement('input'); input.className = 'form-control waypoint-name-alt';
    input.placeholder = i===0 ? 'Alt origin' : (i===num-1 ? 'Alt destination' : 'Alt waypoint');
    div.appendChild(input);
    container.appendChild(div);
  }
  document.getElementById('alternate-section').style.display = 'block';
}

// Geocode via Nominatim
async function geocodeLocation(name) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`;
  const resp = await fetch(url, { headers: { 'Accept-Language':'en' }});
  if (!resp.ok) throw new Error('Errore geocoding per ' + name);
  const data = await resp.json();
  if (!data || data.length===0) throw new Error('Nessun risultato per ' + name);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// Geometry helpers
function toRad(v){ return v * Math.PI / 180; }
function toDeg(v){ return v * 180 / Math.PI; }
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2-lon1))*Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
  let brng = toDeg(Math.atan2(y,x)); brng = (brng + 360) % 360; return brng;
}
function calculateRouteSegments(points) {
  const segments = []; let totalDistance=0, totalTime=0, totalFuel=0;
  const speed = parseFloat(document.getElementById('cruise-speed')?.value) || config.defaultFlightSpeed;
  const consumption = parseFloat(document.getElementById('fuel-consumption')?.value) || config.defaultConsumption;
  for (let i=0;i<points.length-1;i++){
    const from = points[i], to = points[i+1];
    const distance = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);
    const timeMin = (distance / speed) * 60;
    const fuel = consumption * timeMin/60;
    totalDistance += distance; totalTime += timeMin; totalFuel += fuel;
    segments.push({
      from: from.name||'',
      to: to.name||'',
      distance,
      bearing: Math.round(bearing),
      radial: Math.round(bearing),
      flightTime: `${Math.round(timeMin)} min`,
      altitude: ''
    });
  }
  return { segments, totals:{distance: totalDistance, time: totalTime, fuel: totalFuel} };
}

// Display results (main + alternate) - fixed to show first FIX
function displayFlightResults(routeData, containerBodyId='flight-results-body', resultsSectionId='flight-results') {
  const tbody = document.getElementById(containerBodyId);
  const resultsSection = document.getElementById(resultsSectionId);
  if (!tbody || !resultsSection) return;
  tbody.innerHTML = '';
  const pts = (containerBodyId==='flight-results-body') ? waypoints : alternateWaypoints;
  const segs = routeData.segments || [];
  for (let i=0;i<pts.length-1;i++){
    const seg = segs[i] || {};
    const row = tbody.insertRow();
    row.insertCell().textContent = pts[i].name || '';
    row.insertCell().textContent = (pts[i].name && pts[i+1] && pts[i+1].name) ? (`${pts[i].name} -> ${pts[i+1].name}`) : '';
    row.insertCell().textContent = seg.altitude !== undefined ? seg.altitude : '';
    row.insertCell().textContent = seg.distance !== undefined ? seg.distance.toFixed(1) : '';
    row.insertCell().textContent = seg.radial !== undefined ? seg.radial + '°' : '';
    row.insertCell().textContent = seg.flightTime || '';
  }
  if (pts.length>0) {
    const last = pts[pts.length-1];
    const row = tbody.insertRow();
    row.insertCell().textContent = last.name || '';
    row.insertCell().textContent = '-';
    row.insertCell().textContent = '-';
    row.insertCell().textContent = '-';
    row.insertCell().textContent = '-';
    row.insertCell().textContent = '-';
  }
  if (containerBodyId==='flight-results-body') {
    const totalDistanceEl = document.getElementById('total-distance');
    const totalTimeEl = document.getElementById('total-time');
    const fuelRequiredEl = document.getElementById('fuel-required');
    if (routeData.totals) {
      if (totalDistanceEl) totalDistanceEl.textContent = `${routeData.totals.distance.toFixed(1)} NM`;
      if (totalTimeEl) totalTimeEl.textContent = `${Math.round(routeData.totals.time)} min`;
      if (fuelRequiredEl) fuelRequiredEl.textContent = `${routeData.totals.fuel.toFixed(1)} L`;
    }
    resultsSection.style.display='block';
  } else {
    resultsSection.style.display='block';
  }
}

// Main route calculation (handles alternate)
async function calculateRouteHandler() {
  showLoading(true);
  try {
    const mainNames = Array.from(document.querySelectorAll('#waypoints-container .waypoint-name')).map(i=>i.value.trim()).filter(x=>x);
    if (mainNames.length<2) throw new Error('Inserire almeno 2 waypoints (main)');
    const coords=[];
    for (const n of mainNames) coords.push(await geocodeLocation(n));
    waypoints = coords.map((c,idx)=>({ name: mainNames[idx], lat: c.lat, lon: c.lon }));
    const rd = calculateRouteSegments(waypoints);
    lastRouteData = rd;
    displayFlightResults(rd,'flight-results-body','flight-results');

    // Alternate: prefer inputs in alt-waypoints-container; else try alternative inputs if present
    const altNamesInputs = Array.from(document.querySelectorAll('#alt-waypoints-container .waypoint-name-alt')).map(i=>i.value.trim()).filter(x=>x);
    let altNames = altNamesInputs;
    if (altNames.length < 2 && document.getElementById('include-alternate')?.checked) {
      // try fallback inputs if present
      const dep = document.getElementById('alternate-departure')?.value?.trim();
      const dest = document.getElementById('alternate-destination')?.value?.trim();
      if (dep && dest) altNames = [dep, dest];
    }
    if (altNames.length >= 2) {
      const altCoords=[];
      for (const n of altNames) altCoords.push(await geocodeLocation(n));
      alternateWaypoints = altCoords.map((c,idx)=>({ name: altNames[idx], lat: c.lat, lon: c.lon }));
      const ard = calculateRouteSegments(alternateWaypoints);
      lastAlternateData = ard;
      displayFlightResults(ard, 'alternate-results-body', 'alternate-results');
    }
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// Excel helpers that try to preserve template styles
function setCellValuePreserve(ws, addr, value) {
  if (!addr) return;
  const isNum = (v) => (typeof v==='number' && isFinite(v));
  if (ws[addr]) { ws[addr].v = value; ws[addr].t = isNum(value) ? 'n' : 's'; }
  else { ws[addr] = { v: value, t: isNum(value) ? 'n' : 's' }; }
}

// Export to Excel
async function exportToExcel() {
  if (typeof XLSX === 'undefined') { showError('SheetJS non trovato'); return; }
  const templatePath = '/TemplateFlightLog.xlsx';
  try {
    const resp = await fetch(templatePath);
    if (!resp.ok) throw new Error('Template non trovato: ' + resp.status);
    const ab = await resp.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type:'array' });
    const sname = wb.SheetNames[0];
    const ws = wb.Sheets[sname];

    // main route
    if (waypoints.length > 0 && lastRouteData && lastRouteData.segments) {
      setCellValuePreserve(ws,'A11', waypoints[0].name || '');
      for (let i=1;i<waypoints.length;i++){
        const row = 11 + i;
        const seg = lastRouteData.segments[i-1] || {};
        setCellValuePreserve(ws,'A'+row, waypoints[i].name || '');
        setCellValuePreserve(ws,'B'+row, seg.bearing !== undefined ? seg.bearing : '');
        setCellValuePreserve(ws,'C'+row, seg.altitude !== undefined ? seg.altitude : '');
        setCellValuePreserve(ws,'D'+row, seg.distance !== undefined ? Math.round(seg.distance*10)/10 : '');
        setCellValuePreserve(ws,'E'+row, seg.radial !== undefined ? seg.radial : '');
        let ft=''; if (seg.flightTime) { const m=String(seg.flightTime).match(/(\d+)/); if (m) ft=parseInt(m[1]); }
        setCellValuePreserve(ws,'F'+row, ft);
      }
    }

    // fuel summary (replicate Python)
    const segs = lastRouteData?.segments || [];
    const totalTimeMin = segs.reduce((s,x)=> {
      if (!x.flightTime) return s;
      const m = String(x.flightTime).match(/(\d+)/); return s + (m?parseInt(m[1]):0);
    }, 0);
    const consumption = parseFloat(document.getElementById('fuel-consumption')?.value) || config.defaultConsumption;
    const Trip_fuel = Math.round(totalTimeMin * 0.01666 * consumption * 10)/10;
    setCellValuePreserve(ws,'O21', Trip_fuel);
    setCellValuePreserve(ws,'O23', Math.round(Math.max(Trip_fuel*0.05,5)*10)/10);
    setCellValuePreserve(ws,'O24', Math.round((45 * consumption / 60) * 10)/10);

    // alternate
    if (alternateWaypoints.length > 0 && lastAlternateData && lastAlternateData.segments) {
      for (let i=1;i<alternateWaypoints.length;i++){
        const row = 11 + i;
        const seg = lastAlternateData.segments[i-1] || {};
        setCellValuePreserve(ws,'K'+row, alternateWaypoints[i].name || '');
        setCellValuePreserve(ws,'L'+row, seg.bearing !== undefined ? seg.bearing : '');
        setCellValuePreserve(ws,'M'+row, seg.altitude !== undefined ? seg.altitude : '');
        setCellValuePreserve(ws,'N'+row, seg.distance !== undefined ? Math.round(seg.distance*10)/10 : '');
        setCellValuePreserve(ws,'O'+row, seg.radial !== undefined ? seg.radial : '');
        let ft=''; if (seg.flightTime){ const m=String(seg.flightTime).match(/(\d+)/); if (m) ft=parseInt(m[1]); }
        setCellValuePreserve(ws,'P'+row, ft);
      }
      const altTotalTime = lastAlternateData.segments.reduce((s,x)=>{ const m = x.flightTime?String(x.flightTime).match(/(\d+)/):null; return s + (m?parseInt(m[1]):0); }, 0);
      setCellValuePreserve(ws,'O22', Math.round(altTotalTime * 0.01666 * consumption * 10)/10);
    }

    XLSX.writeFile(wb, 'FlightLog_export.xlsx');
    alert('Esportazione completata: FlightLog_export.xlsx');
  } catch (err) {
    console.error(err); showError('Errore export Excel: ' + err.message);
  }
}

// Print to PDF A5: convert filled sheet to HTML and call print()
async function printFlightLog() {
  if (typeof XLSX === 'undefined') { showError('SheetJS non trovato'); return; }
  const templatePath = '/TemplateFlightLog.xlsx';
  try {
    const resp = await fetch(templatePath);
    if (!resp.ok) throw new Error('Template non trovato: ' + resp.status);
    const ab = await resp.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type:'array' });
    const sname = wb.SheetNames[0];
    const ws = wb.Sheets[sname];

    /* Populate ws same as exportToExcel (but don't save file) */
    if (waypoints.length > 0 && lastRouteData && lastRouteData.segments) {
      setCellValuePreserve(ws,'A11', waypoints[0].name || '');
      for (let i=1;i<waypoints.length;i++){
        const row = 11 + i; const seg = lastRouteData.segments[i-1] || {};
        setCellValuePreserve(ws,'A'+row, waypoints[i].name || '');
        setCellValuePreserve(ws,'B'+row, seg.bearing !== undefined ? seg.bearing : '');
        setCellValuePreserve(ws,'C'+row, seg.altitude !== undefined ? seg.altitude : '');
        setCellValuePreserve(ws,'D'+row, seg.distance !== undefined ? Math.round(seg.distance*10)/10 : '');
        setCellValuePreserve(ws,'E'+row, seg.radial !== undefined ? seg.radial : '');
        let ft=''; if (seg.flightTime){ const m=String(seg.flightTime).match(/(\d+)/); if (m) ft=parseInt(m[1]); }
        setCellValuePreserve(ws,'F'+row, ft);
      }
    }
    if (alternateWaypoints.length > 0 && lastAlternateData && lastAlternateData.segments) {
      for (let i=1;i<alternateWaypoints.length;i++){
        const row = 11 + i; const seg = lastAlternateData.segments[i-1] || {};
        setCellValuePreserve(ws,'K'+row, alternateWaypoints[i].name || '');
        setCellValuePreserve(ws,'L'+row, seg.bearing !== undefined ? seg.bearing : '');
        setCellValuePreserve(ws,'M'+row, seg.altitude !== undefined ? seg.altitude : '');
        setCellValuePreserve(ws,'N'+row, seg.distance !== undefined ? Math.round(seg.distance*10)/10 : '');
        setCellValuePreserve(ws,'O'+row, seg.radial !== undefined ? seg.radial : '');
        let ft=''; if (seg.flightTime){ const m=String(seg.flightTime).match(/(\d+)/); if (m) ft=parseInt(m[1]); }
        setCellValuePreserve(ws,'P'+row, ft);
      }
    }

    // sheet to html
    const sheetHTML = XLSX.utils.sheet_to_html(ws, { editable:false });
    const win = window.open('', '_blank');
    const style = `<style>@page { size:A5; margin:8mm } body{font-family:Arial,Helvetica,sans-serif} table{border-collapse:collapse;width:100%} td,th{border:1px solid #333;padding:4px;font-size:10pt}</style>`;
    win.document.write('<html><head><title>Flight Log - Print</title>' + style + '</head><body>');
    win.document.write(sheetHTML);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(()=>{ win.focus(); win.print(); }, 700);
  } catch (err) {
    console.error(err); showError('Errore stampa PDF: ' + err.message);
  }
}

// Weight & Balance
function initializeWeightBalanceChart() {
  const canvas = document.getElementById('wb-chart'); if (!canvas) return;
  const container = canvas.parentElement; if (container){ container.style.minHeight='260px'; container.style.position='relative'; }
  const ctx = canvas.getContext('2d'); if (currentChart) try{ currentChart.destroy(); }catch(e){} currentChart=null;
  currentChart = new Chart(ctx, {
    type:'scatter',
    data:{ datasets:[
      { label:'Envelope', data: config.weightBalanceEnvelope.map(p=>({x:p.x,y:p.y})), showLine:true, fill:true, pointRadius:3 },
      { label:'Current', data:[], pointRadius:8 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ x:{type:'linear', min:400, max:1400, title:{display:true,text:'CG (mm)'}}, y:{min:0, max:1400, title:{display:true,text:'Weight (kg)'}} }
    }
  });
}
function updateWeightBalanceChart(armMm, weight) {
  if (!currentChart) return;
  currentChart.data.datasets[1].data = (weight>0) ? [{x:armMm,y:weight}] : [];
  currentChart.update();
}
function calculateWBFromDOM() {
  const table = document.querySelector('.wb-table'); if (!table) return;
  const tbody = table.tBodies[0]; if (!tbody) return;
  const rows = Array.from(tbody.rows).filter(r=>!r.classList.contains('total-row'));
  let totalWeight=0, totalMoment=0;
  rows.forEach(r=>{
    const label = r.cells[0]?.textContent?.toLowerCase() || '';
    const weightInput = r.querySelector('.wb-weight-input'); const armInput = r.querySelector('.wb-arm-input');
    const momentOut = r.querySelectorAll('input')[2];
    let w = parseFloat(weightInput?.value) || 0; let arm = parseFloat(armInput?.value) || 0;
    if (label.includes('fuel')) {
      const wkg = w * config.fuelDensity; const m = wkg * arm;
      if (momentOut) momentOut.value = m.toFixed(1); totalWeight += wkg; totalMoment += m;
    } else {
      const m = w * arm; if (momentOut) momentOut.value = m.toFixed(1); totalWeight += w; totalMoment += m;
    }
  });
  const totalRow = document.querySelector('.wb-table .total-row');
  if (totalRow) {
    const inputs = totalRow.querySelectorAll('input'); const cg = totalWeight>0 ? (totalMoment/totalWeight) : 0;
    if (inputs[0]) inputs[0].value = totalWeight.toFixed(1);
    if (inputs[1]) inputs[1].value = cg.toFixed(3);
    if (inputs[2]) inputs[2].value = totalMoment.toFixed(1);
    updateWeightBalanceChart(cg*1000, totalWeight);
    const status = document.getElementById('wb-status'); if (status) { const inside = isPointInEnvelope(cg*1000, totalWeight); status.style.display='block'; status.textContent = inside ? 'WITHIN W&B RANGE - Safe to fly' : 'OUTSIDE W&B RANGE - Not safe to fly'; status.className = inside ? 'wb-status safe' : 'wb-status unsafe'; }
  }
}
function isPointInEnvelope(x,y){ const poly = config.weightBalanceEnvelope; let inside=false; for (let i=0,j=poly.length-1;i<poly.length;j=i++) { const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y; const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+Number.EPSILON)+xi); if (intersect) inside=!inside; } return inside; }

// Auto-apply aircraft select
const aircraftProfiles = {
  'Aircraft A': { arms:[1.006,1.155,2.035,1.075,2.600], weights:[] },
  'Aircraft B': { arms:[1.02,1.16,2.04,1.08,2.62], weights:[] }
};
function applyAircraftProfileFromSelect() {
  const sel = document.getElementById('aircraft-select'); if (!sel) return;
  const profile = aircraftProfiles[sel.value] || null;
  const applyBtn = document.querySelector("button[onclick*='applyAircraftProfile']"); if (applyBtn) applyBtn.style.display='none';
  if (!profile) return;
  const armInputs = document.querySelectorAll('.wb-arm-input'); armInputs.forEach((inp,idx)=>{ if (profile.arms[idx]!==undefined) inp.value = profile.arms[idx]; });
  const weightInputs = document.querySelectorAll('.wb-weight-input'); if (profile.weights && profile.weights.length) weightInputs.forEach((inp,idx)=>{ if (profile.weights[idx]!==undefined) inp.value = profile.weights[idx]; });
  calculateWBFromDOM();
}

// Responsive adjustments
function setupResponsive() {
  if (!document.querySelector('meta[name=\"viewport\"]')) { const meta=document.createElement('meta'); meta.name='viewport'; meta.content='width=device-width,initial-scale=1'; document.head.appendChild(meta); }
  function adjust(){ const c=document.querySelector('.chart-container'); if (c){ if (window.innerWidth<480) c.style.minHeight='220px'; else if (window.innerWidth<768) c.style.minHeight='260px'; else c.style.minHeight='320px'; } if (currentChart) currentChart.resize(); }
  window.addEventListener('resize', adjust); adjust();
}

// Init
document.addEventListener('DOMContentLoaded', ()=>{
  try { initializeWeightBalanceChart(); } catch(e){ console.debug('chart init', e.message); }
  const sel = document.getElementById('aircraft-select'); if (sel) { sel.addEventListener('change', applyAircraftProfileFromSelect); applyAircraftProfileFromSelect(); }
  const calcBtn = document.querySelector('button[onclick*=\"calculateRoute\"]'); if (calcBtn) calcBtn.addEventListener('click', calculateRouteHandler);
  const expBtn = document.querySelector('button[onclick*=\"exportToExcel\"]'); if (expBtn) expBtn.addEventListener('click', exportToExcel);
  const printBtn = document.querySelector('button[onclick*=\"printFlightLog\"]'); if (printBtn) printBtn.addEventListener('click', printFlightLog);
  const genBtn = document.querySelector('button[onclick*=\"generateWaypoints\"]'); if (genBtn) genBtn.addEventListener('click', generateWaypoints);
  const genAltBtn = document.querySelector('button[onclick*=\"generateAlternateWaypoints\"]'); if (genAltBtn) genAltBtn.addEventListener('click', generateAlternateWaypoints);
  const calcWBBtn = document.querySelector('button[onclick*=\"calcWB\"]'); if (calcWBBtn) calcWBBtn.addEventListener('click', calculateWBFromDOM);
  setupResponsive();
});
