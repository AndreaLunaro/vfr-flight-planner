// VFR Flight Planner - Versione Semplificata per Vercel
class VFRFlightPlanner {
    constructor() {
        this.flightData = {
            waypoints: [],
            alternateWaypoints: [],
            flightResults: [],
            alternateResults: [],
            fuelData: {},
            alternateFuelData: {}
        };

        this.weightBalanceData = {
            envelope: [[600,500], [1280,1060], [1100,1060], [910,980], [500,550]],
            arms: [1.006, 1.155, 2.035, 1.075, 2.6],
            categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack", "Total"],
            weights: [0, 0, 0, 0, 0, 0],
            moments: [0, 0, 0, 0, 0, 0],
            chart: null
        };

        this.constants = {
            earthRadius: 6371,
            nauticalMileKm: 1.852,
            metersToFeet: 3.28084,
            baseAltitude: 1500
        };

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupApplication();
            });
        } else {
            this.setupApplication();
        }
    }

    setupApplication() {
        this.bindEvents();
        this.initializeWeightBalanceTable();
        this.addWaypointInputs();

        const wbTab = document.getElementById('wb-tab');
        if (wbTab) {
            wbTab.addEventListener('click', () => {
                setTimeout(() => {
                    if (!this.weightBalanceData.chart) {
                        this.initializeWeightBalanceChart();
                    }
                }, 100);
            });
        }
    }

    bindEvents() {
        // Flight Planning Events
        const addWaypointsBtn = document.getElementById('addWaypoints');
        if (addWaypointsBtn) {
            addWaypointsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addWaypointInputs();
            });
        }

        const addAlternateWaypointsBtn = document.getElementById('addAlternateWaypoints');
        if (addAlternateWaypointsBtn) {
            addAlternateWaypointsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addAlternateWaypointInputs();
            });
        }

        const calculateBtn = document.getElementById('calculateFlight');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.calculateFlightData();
            });
        }

        const resetBtn = document.getElementById('resetPlan');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetFlightPlan();
            });
        }

        // Export buttons
        const exportBtn = document.getElementById('exportPlan');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportPlan();
            });
        }

        const exportPdfBtn = document.getElementById('exportPdf');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportPdfOnly();
            });
        }

        const alternateCheckbox = document.getElementById('includeAlternate');
        if (alternateCheckbox) {
            alternateCheckbox.addEventListener('change', (e) => {
                this.toggleAlternateSection(e.target.checked);
            });
        }

        // Weight & Balance Events
        const calculateWBBtn = document.getElementById('calculateWB');
        if (calculateWBBtn) {
            calculateWBBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.calculateWeightBalance();
            });
        }

        const resetWBBtn = document.getElementById('resetWB');
        if (resetWBBtn) {
            resetWBBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetWeightBalance();
            });
        }
    }

    addWaypointInputs() {
        const numWaypointsInput = document.getElementById('numWaypoints');
        if (!numWaypointsInput) return;

        const numWaypoints = parseInt(numWaypointsInput.value) || 2;
        const container = document.getElementById('waypointInputs');
        if (!container) return;

        if (numWaypoints < 2 || numWaypoints > 20) {
            this.showMessage('Il numero di waypoint deve essere tra 2 e 20', 'error');
            numWaypointsInput.value = Math.max(2, Math.min(20, numWaypoints));
            return;
        }

        container.innerHTML = '';
        for (let i = 0; i < numWaypoints; i++) {
            const div = document.createElement('div');
            div.className = 'waypoint-input';
            div.innerHTML = `
                <label for="waypoint${i}" class="form-label aviation-label">Waypoint ${i + 1}</label>
                <input type="text" class="form-control aviation-input" id="waypoint${i}" 
                       placeholder="Nome città (es. Roma, Milano)" autocomplete="off">
            `;
            container.appendChild(div);
        }
        this.showMessage(`${numWaypoints} campi waypoint generati con successo`, 'success');
    }

    addAlternateWaypointInputs() {
        const numAlternateWaypointsInput = document.getElementById('numAlternateWaypoints');
        if (!numAlternateWaypointsInput) return;

        const numWaypoints = parseInt(numAlternateWaypointsInput.value) || 2;
        const container = document.getElementById('alternateInputs');
        if (!container) return;

        if (numWaypoints < 2 || numWaypoints > 10) {
            this.showMessage('Il numero di waypoint alternati deve essere tra 2 e 10', 'error');
            numAlternateWaypointsInput.value = Math.max(2, Math.min(10, numWaypoints));
            return;
        }

        container.innerHTML = '';
        for (let i = 0; i < numWaypoints; i++) {
            const div = document.createElement('div');
            div.className = 'waypoint-input';
            div.innerHTML = `
                <label for="alternateWaypoint${i}" class="form-label aviation-label">Alternate Waypoint ${i + 1}</label>
                <input type="text" class="form-control aviation-input" id="alternateWaypoint${i}" 
                       placeholder="Nome città (es. Napoli, Venezia)" autocomplete="off">
            `;
            container.appendChild(div);
        }
        this.showMessage(`${numWaypoints} campi waypoint alternati generati con successo`, 'success');
    }

    toggleAlternateSection(show) {
        const section = document.getElementById('alternateSection');
        if (!section) return;

        if (show) {
            section.style.display = 'block';
            const numAlternateWaypointsInput = document.getElementById('numAlternateWaypoints');
            if (numAlternateWaypointsInput) {
                numAlternateWaypointsInput.value = 2;
            }
            this.addAlternateWaypointInputs();
        } else {
            section.style.display = 'none';
            this.flightData.alternateResults = [];
            this.flightData.alternateFuelData = {};
            this.updateAlternateTable();
            this.updateAlternateFuelDisplay();
        }
    }

    async calculateFlightData() {
        this.showLoading(true);
        try {
            const numWaypointsInput = document.getElementById('numWaypoints');
            if (!numWaypointsInput) throw new Error('Campo numero waypoint non trovato');

            const numWaypoints = parseInt(numWaypointsInput.value) || 2;
            const waypoints = [];

            for (let i = 0; i < numWaypoints; i++) {
                const input = document.getElementById(`waypoint${i}`);
                if (!input) continue;
                const value = input.value.trim();
                if (!value) {
                    throw new Error(`Waypoint ${i + 1} è obbligatorio`);
                }
                waypoints.push(value);
            }

            if (waypoints.length === 0) {
                throw new Error('Inserire almeno un waypoint');
            }

            this.showMessage('Geocodificazione waypoints in corso...', 'info');
            const geocodedWaypoints = await this.geocodeWaypoints(waypoints);
            this.flightData.waypoints = geocodedWaypoints;

            this.showMessage('Calcolo rotta in corso...', 'info');
            this.flightData.flightResults = await this.calculateRoute(geocodedWaypoints);
            this.calculateFuelData();

            const alternateCheckbox = document.getElementById('includeAlternate');
            if (alternateCheckbox && alternateCheckbox.checked) {
                this.showMessage('Calcolo rotta alternata in corso...', 'info');
                await this.calculateAlternateRoute();
            }

            this.updateFlightTable();
            this.updateFuelDisplay();

            const exportBtn = document.getElementById('exportPlan');
            if (exportBtn) exportBtn.disabled = false;

            const exportPdfBtn = document.getElementById('exportPdf');
            if (exportPdfBtn) exportPdfBtn.disabled = false;

            this.showMessage('Calcoli completati con successo!', 'success');

        } catch (error) {
            console.error('Calculation error:', error);
            this.showMessage(`Errore: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async geocodeWaypoints(waypoints) {
        const geocoded = [];
        for (const waypoint of waypoints) {
            const query = `${waypoint}, Italia`;
            try {
                const coords = await this.geocodeWithNominatim(query);
                const elevation = await this.getElevation(coords.lat, coords.lon);
                geocoded.push({
                    name: waypoint,
                    lat: coords.lat,
                    lon: coords.lon,
                    elevation: elevation
                });
            } catch (error) {
                console.error(`Geocoding error for ${waypoint}:`, error);
                throw new Error(`Impossibile geocodificare: ${waypoint}`);
            }
        }
        return geocoded;
    }

    async geocodeWithNominatim(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'VFR Flight Planner App'
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding request failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.length === 0) {
            throw new Error(`Nessun risultato trovato per: ${query}`);
        }

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }

    async getElevation(lat, lon) {
        try {
            const url = `https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lon}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const elevationMeters = data.results[0].elevation || 0;
                    return Math.round(elevationMeters * this.constants.metersToFeet + this.constants.baseAltitude);
                }
            }
        } catch (error) {
            console.warn('Elevation API error:', error);
        }
        return this.constants.baseAltitude;
    }

    async calculateRoute(waypoints) {
        const results = [];
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            let distance = 0;
            let heading = 0;
            let radial = 0;

            if (i > 0) {
                const prevWaypoint = waypoints[i - 1];
                distance = this.calculateDistance(prevWaypoint.lat, prevWaypoint.lon, waypoint.lat, waypoint.lon);
                heading = this.calculateBearing(prevWaypoint.lat, prevWaypoint.lon, waypoint.lat, waypoint.lon);
            }

            if (i > 0 && waypoints.length > 0) {
                radial = this.calculateBearing(waypoint.lat, waypoint.lon, waypoints[0].lat, waypoints[0].lon);
            }

            const flightSpeedInput = document.getElementById('flightSpeed');
            const flightSpeed = parseFloat(flightSpeedInput ? flightSpeedInput.value : 90) || 90;
            const flightTime = distance > 0 ? Math.round(distance / flightSpeed * 60) : 0;

            results.push({
                fix: waypoint.name,
                route: heading > 0 ? Math.round(heading).toString().padStart(3, '0') : '---',
                altitude: waypoint.elevation,
                distance: Math.round(distance * 10) / 10,
                radial: radial > 0 ? Math.round(radial).toString().padStart(3, '0') : '---',
                flightTime: flightTime
            });
        }
        return results;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = this.constants.earthRadius;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        return distanceKm / this.constants.nauticalMileKm;
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = this.toRadians(lon2 - lon1);
        const lat1Rad = this.toRadians(lat1);
        const lat2Rad = this.toRadians(lat2);
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        let bearing = this.toDegrees(Math.atan2(y, x));
        return (bearing + 360) % 360;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    calculateFuelData() {
        const totalTime = this.flightData.flightResults.reduce((sum, result) => sum + result.flightTime, 0);
        const fuelConsumptionInput = document.getElementById('fuelConsumption');
        const fuelConsumption = parseFloat(fuelConsumptionInput ? fuelConsumptionInput.value : 30) || 30;

        const tripFuel = Math.round((totalTime * 0.01666 * fuelConsumption) * 10) / 10;
        const contingencyFuel = Math.round(Math.max(tripFuel * 0.05, 5) * 10) / 10;
        const reserveFuel = Math.round((45 * fuelConsumption / 60) * 10) / 10;
        const totalFuel = Math.round((tripFuel + contingencyFuel + reserveFuel) * 10) / 10;

        this.flightData.fuelData = {
            tripFuel,
            contingencyFuel,
            reserveFuel,
            totalFuel
        };
    }

    async calculateAlternateRoute() {
        const numAlternateWaypointsInput = document.getElementById('numAlternateWaypoints');
        if (!numAlternateWaypointsInput) return;

        const numWaypoints = parseInt(numAlternateWaypointsInput.value) || 2;
        const alternateWaypoints = [];

        for (let i = 0; i < numWaypoints; i++) {
            const input = document.getElementById(`alternateWaypoint${i}`);
            if (!input) continue;
            const value = input.value.trim();
            if (!value) {
                throw new Error(`Alternate Waypoint ${i + 1} è obbligatorio`);
            }
            alternateWaypoints.push(value);
        }

        if (alternateWaypoints.length === 0) {
            throw new Error('Inserire almeno un waypoint alternato');
        }

        const geocodedAlternateWaypoints = await this.geocodeWaypoints(alternateWaypoints);
        this.flightData.alternateWaypoints = geocodedAlternateWaypoints;
        this.flightData.alternateResults = await this.calculateRoute(geocodedAlternateWaypoints);

        const totalTime = this.flightData.alternateResults.reduce((sum, result) => sum + result.flightTime, 0);
        const fuelConsumptionInput = document.getElementById('fuelConsumption');
        const fuelConsumption = parseFloat(fuelConsumptionInput ? fuelConsumptionInput.value : 30) || 30;
        const alternateFuel = Math.round((totalTime * 0.01666 * fuelConsumption) * 10) / 10;

        this.flightData.alternateFuelData = { alternateFuel };
        this.updateAlternateTable();
        this.updateAlternateFuelDisplay();
    }

    // FUNZIONE SEMPLIFICATA per generazione HTML
    generateFormattedHTML() {
        const currentDate = new Date().toLocaleDateString('it-IT');
        const currentTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; }
        .header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; }
        th { background-color: #1e3a8a; color: white; }
        .fuel-item { margin: 5px 0; padding: 5px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <div class="header">VFR FLIGHT PLAN</div>
    <p>Data: ${currentDate} - Ora: ${currentTime}</p>
    <p>Velocità: ${document.getElementById('flightSpeed')?.value || 90} kt - Consumo: ${document.getElementById('fuelConsumption')?.value || 30} l/h</p>

    <h3>Trip Principale</h3>
    <table>
        <tr><th>FIX</th><th>Route</th><th>Alt[Ft]</th><th>Dist[NM]</th><th>Radial</th><th>Flight Time[min]</th></tr>`;

        this.flightData.flightResults.forEach(result => {
            html += `<tr><td>${result.fix}</td><td>${result.route}</td><td>${result.altitude}</td><td>${result.distance}</td><td>${result.radial}</td><td>${result.flightTime}</td></tr>`;
        });

        html += `</table>`;

        const fuel = this.flightData.fuelData;
        if (fuel && fuel.tripFuel) {
            html += `<div class="fuel-item">Trip Fuel: ${fuel.tripFuel} litri</div>
                     <div class="fuel-item">Contingency Fuel: ${fuel.contingencyFuel} litri</div>
                     <div class="fuel-item">Reserve Fuel: ${fuel.reserveFuel} litri</div>
                     <div class="fuel-item"><strong>Total Fuel: ${fuel.totalFuel} litri</strong></div>`;
        }

        if (this.flightData.alternateResults && this.flightData.alternateResults.length > 0) {
            html += `<h3>Aeroporto Alternato</h3><table>
                     <tr><th>FIX</th><th>Route</th><th>Alt[Ft]</th><th>Dist[NM]</th><th>Radial</th><th>Flight Time[min]</th></tr>`;
            this.flightData.alternateResults.forEach(result => {
                html += `<tr><td>${result.fix}</td><td>${result.route}</td><td>${result.altitude}</td><td>${result.distance}</td><td>${result.radial}</td><td>${result.flightTime}</td></tr>`;
            });
            html += `</table>`;
            if (this.flightData.alternateFuelData && this.flightData.alternateFuelData.alternateFuel) {
                html += `<div class="fuel-item">Alternate Fuel: ${this.flightData.alternateFuelData.alternateFuel} litri</div>`;
            }
        }

        html += `</body></html>`;
        return html;
    }
    // EXPORT FUNCTIONS - Versione semplificata
    async exportPlan() {
        if (!this.flightData.flightResults || this.flightData.flightResults.length === 0) {
            this.showMessage('Nessun dato di volo da esportare. Calcolare prima il piano di volo.', 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('Generazione file Excel e PDF in corso...', 'info');

            // Solo Excel per ora (PDF separato)
            await this.exportToExcel();

            // Genera PDF
            await this.generateAndDownloadPDF();

            this.showMessage('Export completato con successo!', 'success');

        } catch (error) {
            console.error('Export error:', error);
            this.showMessage(`Errore durante l'export: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async exportPdfOnly() {
        if (!this.flightData.flightResults || this.flightData.flightResults.length === 0) {
            this.showMessage('Nessun dato di volo da esportare. Calcolare prima il piano di volo.', 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('Generazione file PDF in corso...', 'info');

            await this.generateAndDownloadPDF();

            this.showMessage('PDF generato e scaricato con successo!', 'success');

        } catch (error) {
            console.error('PDF export error:', error);
            this.showMessage(`Errore durante la generazione PDF: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async generateAndDownloadPDF() {
        try {
            const htmlContent = this.generateFormattedHTML();

            console.log('Sending HTML to PDF API...');

            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    htmlContent: htmlContent
                })
            });

            if (!response.ok) {
                let errorMessage = 'Errore nella generazione PDF';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `HTTP Error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error('PDF vuoto ricevuto dal server');
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'flight-plan.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating PDF:', error);
            throw new Error(`Errore nella generazione PDF: ${error.message}`);
        }
    }

    async exportToExcel() {
        try {
            if (!window.ExcelJS) {
                throw new Error('ExcelJS library not loaded');
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('VFR Flight Plan');

            // Header
            worksheet.addRow(['VFR FLIGHT PLAN']);
            worksheet.addRow([]);
            worksheet.addRow(['Data:', new Date().toLocaleDateString('it-IT')]);
            worksheet.addRow(['Velocità:', (document.getElementById('flightSpeed')?.value || 90) + ' kt']);
            worksheet.addRow(['Consumo:', (document.getElementById('fuelConsumption')?.value || 30) + ' l/h']);
            worksheet.addRow([]);

            // Main route
            worksheet.addRow(['Trip Principale']);
            const headerRow = worksheet.addRow(['FIX', 'Route', 'Alt[Ft]', 'Dist[NM]', 'Radial', 'Flight Time[min]']);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            });

            this.flightData.flightResults.forEach(result => {
                worksheet.addRow([result.fix, result.route, result.altitude, result.distance, result.radial, result.flightTime]);
            });

            worksheet.addRow([]);

            // Fuel data
            const fuel = this.flightData.fuelData;
            if (fuel && fuel.tripFuel) {
                worksheet.addRow(['Fuel Data']);
                worksheet.addRow(['Trip Fuel:', fuel.tripFuel + ' litri']);
                worksheet.addRow(['Contingency Fuel:', fuel.contingencyFuel + ' litri']);
                worksheet.addRow(['Reserve Fuel:', fuel.reserveFuel + ' litri']);
                worksheet.addRow(['Total Fuel:', fuel.totalFuel + ' litri']);
                worksheet.addRow([]);
            }

            // Alternate route
            if (this.flightData.alternateResults && this.flightData.alternateResults.length > 0) {
                worksheet.addRow(['Aeroporto Alternato']);
                const altHeaderRow = worksheet.addRow(['FIX', 'Route', 'Alt[Ft]', 'Dist[NM]', 'Radial', 'Flight Time[min]']);
                altHeaderRow.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                });

                this.flightData.alternateResults.forEach(result => {
                    worksheet.addRow([result.fix, result.route, result.altitude, result.distance, result.radial, result.flightTime]);
                });

                if (this.flightData.alternateFuelData && this.flightData.alternateFuelData.alternateFuel) {
                    worksheet.addRow([]);
                    worksheet.addRow(['Alternate Fuel:', this.flightData.alternateFuelData.alternateFuel + ' litri']);
                }
            }

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'FlightPlan.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exporting to Excel:', error);
            throw new Error(`Errore nella generazione del file Excel: ${error.message}`);
        }
    }

    updateFlightTable() {
        const tbody = document.getElementById('flightTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.flightData.flightResults.forEach(result => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${result.fix}</td>
                <td>${result.route}</td>
                <td>${result.altitude}</td>
                <td>${result.distance}</td>
                <td>${result.radial}</td>
                <td>${result.flightTime}</td>
            `;
        });
    }

    updateAlternateTable() {
        const tbody = document.getElementById('alternateTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.flightData.alternateResults.forEach(result => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${result.fix}</td>
                <td>${result.route}</td>
                <td>${result.altitude}</td>
                <td>${result.distance}</td>
                <td>${result.radial}</td>
                <td>${result.flightTime}</td>
            `;
        });
    }

    updateFuelDisplay() {
        const fuel = this.flightData.fuelData;
        if (!fuel || !fuel.tripFuel) return;

        const tripFuelEl = document.getElementById('tripFuel');
        const contingencyFuelEl = document.getElementById('contingencyFuel');
        const reserveFuelEl = document.getElementById('reserveFuel');
        const totalFuelEl = document.getElementById('totalFuel');

        if (tripFuelEl) tripFuelEl.textContent = `${fuel.tripFuel} litri`;
        if (contingencyFuelEl) contingencyFuelEl.textContent = `${fuel.contingencyFuel} litri`;
        if (reserveFuelEl) reserveFuelEl.textContent = `${fuel.reserveFuel} litri`;
        if (totalFuelEl) totalFuelEl.textContent = `${fuel.totalFuel} litri`;
    }

    updateAlternateFuelDisplay() {
        const alternateFuel = this.flightData.alternateFuelData;
        if (!alternateFuel || !alternateFuel.alternateFuel) return;

        const alternateFuelEl = document.getElementById('alternateFuel');
        if (alternateFuelEl) alternateFuelEl.textContent = `${alternateFuel.alternateFuel} litri`;
    }

    resetFlightPlan() {
        this.flightData = {
            waypoints: [],
            alternateWaypoints: [],
            flightResults: [],
            alternateResults: [],
            fuelData: {},
            alternateFuelData: {}
        };

        const flightTableBody = document.getElementById('flightTableBody');
        if (flightTableBody) flightTableBody.innerHTML = '';

        const alternateTableBody = document.getElementById('alternateTableBody');
        if (alternateTableBody) alternateTableBody.innerHTML = '';

        const waypointInputs = document.getElementById('waypointInputs');
        if (waypointInputs) waypointInputs.innerHTML = '';

        const alternateInputs = document.getElementById('alternateInputs');
        if (alternateInputs) alternateInputs.innerHTML = '';

        const includeAlternate = document.getElementById('includeAlternate');
        if (includeAlternate) includeAlternate.checked = false;

        const alternateSection = document.getElementById('alternateSection');
        if (alternateSection) alternateSection.style.display = 'none';

        const exportBtn = document.getElementById('exportPlan');
        if (exportBtn) exportBtn.disabled = true;

        const exportPdfBtn = document.getElementById('exportPdf');
        if (exportPdfBtn) exportPdfBtn.disabled = true;

        ['tripFuel', 'contingencyFuel', 'reserveFuel', 'totalFuel', 'alternateFuel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-- litri';
        });

        const flightSpeed = document.getElementById('flightSpeed');
        if (flightSpeed) flightSpeed.value = '90';

        const fuelConsumption = document.getElementById('fuelConsumption');
        if (fuelConsumption) fuelConsumption.value = '30';

        const numWaypoints = document.getElementById('numWaypoints');
        if (numWaypoints) numWaypoints.value = '2';

        const numAlternateWaypoints = document.getElementById('numAlternateWaypoints');
        if (numAlternateWaypoints) numAlternateWaypoints.value = '2';

        this.addWaypointInputs();
        this.showMessage('Piano di volo resettato con successo', 'success');
    }

    // Versione semplificata Weight & Balance
    initializeWeightBalanceTable() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.weightBalanceData.categories.forEach((category, index) => {
            const row = tbody.insertRow();
            const isTotal = index === this.weightBalanceData.categories.length - 1;
            row.innerHTML = `
                <td>${category}</td>
                <td>${isTotal ? '<span id="totalWeight">0</span>' : 
                    `<input type="number" class="form-control aviation-input" id="weight${index}" value="0" min="0" step="0.1" ${isTotal ? 'readonly' : ''}>`}</td>
                <td>${isTotal ? '<span id="totalArm">0</span>' : this.weightBalanceData.arms[index]}</td>
                <td>${isTotal ? '<span id="totalMoment">0</span>' : `<span id="moment${index}">0</span>`}</td>
            `;
        });
    }

    // Versione semplificata chart (senza Chart.js per ridurre dipendenze)
    initializeWeightBalanceChart() {
        console.log('Weight Balance Chart simplified - Chart.js removed to reduce bundle size');
        // Chart rimosso per semplicità - può essere aggiunto successivamente
    }

    calculateWeightBalance() {
        let totalWeight = 0;
        let totalMoment = 0;

        for (let i = 0; i < this.weightBalanceData.categories.length - 1; i++) {
            const weightInput = document.getElementById(`weight${i}`);
            const weight = parseFloat(weightInput ? weightInput.value : 0) || 0;
            const arm = this.weightBalanceData.arms[i];

            let moment;
            if (i === 3) { // Fuel on Board - special calculation
                moment = weight * 0.72 * arm;
            } else {
                moment = weight * arm;
            }

            const momentEl = document.getElementById(`moment${i}`);
            if (momentEl) momentEl.textContent = Math.round(moment * 100) / 100;

            totalWeight += weight;
            totalMoment += moment;
        }

        const totalWeightEl = document.getElementById('totalWeight');
        const totalArmEl = document.getElementById('totalArm');
        const totalMomentEl = document.getElementById('totalMoment');

        if (totalWeightEl) totalWeightEl.textContent = Math.round(totalWeight * 100) / 100;
        if (totalArmEl) totalArmEl.textContent = totalWeight > 0 ? Math.round((totalMoment / totalWeight) * 1000) / 1000 : 0;
        if (totalMomentEl) totalMomentEl.textContent = Math.round(totalMoment * 100) / 100;

        this.showMessage('Calcoli Weight & Balance completati', 'success');
    }

    resetWeightBalance() {
        for (let i = 0; i < this.weightBalanceData.categories.length - 1; i++) {
            const weightInput = document.getElementById(`weight${i}`);
            if (weightInput) weightInput.value = '0';

            const momentEl = document.getElementById(`moment${i}`);
            if (momentEl) momentEl.textContent = '0';
        }

        const totalWeightEl = document.getElementById('totalWeight');
        const totalArmEl = document.getElementById('totalArm');
        const totalMomentEl = document.getElementById('totalMoment');

        if (totalWeightEl) totalWeightEl.textContent = '0';
        if (totalArmEl) totalArmEl.textContent = '0';
        if (totalMomentEl) totalMomentEl.textContent = '0';

        this.showMessage('Weight & Balance resettato', 'success');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('message');
        if (!messageDiv) return;

        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    showLoading(show) {
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) return;
        loadingDiv.style.display = show ? 'block' : 'none';
    }
}

// Initialize the application
const flightPlanner = new VFRFlightPlanner();
window.VFRFlightPlanner = flightPlanner;