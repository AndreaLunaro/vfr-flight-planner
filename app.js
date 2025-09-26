// VFR Flight Planner JavaScript Application - FINALE OTTIMIZZATO A4 v2.7.0
// Final optimized for single A4 landscape page with compact flight tables + larger bottom tables
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

        // Per salvare il blob Excel e HTML generato
        this.lastExcelBlob = null;
        this.lastGeneratedHTML = null;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
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
        this.addWaypointInputs(); // Initialize with default waypoints

        // Initialize Weight & Balance chart when that tab is first shown
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

        // Export button finale ottimizzato
        const exportBtn = document.getElementById('exportPlan');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportExcelAndPDF(); // FUNZIONE FINALE OTTIMIZZATA
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

        const updateWBBtn = document.getElementById('updateWBRange');
        if (updateWBBtn) {
            updateWBBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showWBRangeModal();
            });
        }

        const saveWBBtn = document.getElementById('saveWBRange');
        if (saveWBBtn) {
            saveWBBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveWBRange();
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
            // Initialize with default alternate waypoints
            const numAlternateWaypointsInput = document.getElementById('numAlternateWaypoints');
            if (numAlternateWaypointsInput) {
                numAlternateWaypointsInput.value = 2;
            }
            this.addAlternateWaypointInputs();
        } else {
            section.style.display = 'none';
            // Clear alternate data
            this.flightData.alternateResults = [];
            this.flightData.alternateFuelData = {};
            this.updateAlternateTable();
            this.updateAlternateFuelDisplay();
        }
    }

    async calculateFlightData() {
        this.showLoading(true);
        try {
            // Get waypoint names
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

            // Show progress message
            this.showMessage('Geocodificazione waypoints in corso...', 'info');

            // Geocode waypoints
            const geocodedWaypoints = await this.geocodeWaypoints(waypoints);
            this.flightData.waypoints = geocodedWaypoints;

            this.showMessage('Calcolo rotta in corso...', 'info');

            // Calculate flight results
            this.flightData.flightResults = await this.calculateRoute(geocodedWaypoints);

            // Calculate fuel data
            this.calculateFuelData();

            // Handle alternate if enabled
            const alternateCheckbox = document.getElementById('includeAlternate');
            if (alternateCheckbox && alternateCheckbox.checked) {
                this.showMessage('Calcolo rotta alternata in corso...', 'info');
                await this.calculateAlternateRoute();
            }

            // Update display
            this.updateFlightTable();
            this.updateFuelDisplay();

            const exportBtn = document.getElementById('exportPlan');
            if (exportBtn) exportBtn.disabled = false;

            this.showMessage('Calcoli completati con successo! I risultati sono visibili nelle tabelle.', 'success');

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
                // Try Nominatim
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
        return this.constants.baseAltitude; // Default altitude
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

            // Calculate radial (bearing from destination to first waypoint)
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

    calculateAlternateFuelData() {
        const totalTime = this.flightData.alternateResults.reduce((sum, result) => sum + result.flightTime, 0);
        const fuelConsumptionInput = document.getElementById('fuelConsumption');
        const fuelConsumption = parseFloat(fuelConsumptionInput ? fuelConsumptionInput.value : 30) || 30;

        const alternateFuel = Math.round((totalTime * 0.01666 * fuelConsumption) * 10) / 10;
        this.flightData.alternateFuelData = {
            alternateFuel
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
        this.calculateAlternateFuelData();
        this.updateAlternateTable();
        this.updateAlternateFuelDisplay();
    }

    // ===== EXPORT FUNCTIONS FINALE OTTIMIZZATE =====

    // FUNZIONE PRINCIPALE: Export Excel + PDF finale ottimizzato
    async exportExcelAndPDF() {
        if (!this.flightData.flightResults || this.flightData.flightResults.length === 0) {
            this.showMessage('Nessun dato di volo da esportare. Calcolare prima il piano di volo.', 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('Generazione Excel e PDF finale ottimizzato in corso...', 'info');

            // Step 1: Genera Excel (mantenuto identico)
            await this.exportToExcelWithTemplate();

            // Step 2: Genera HTML FINALE OTTIMIZZATO
            this.showMessage('Generazione HTML finale ottimizzato...', 'info');
            this.lastGeneratedHTML = this.generateExcelReplicaHTML();

            // Step 3: Converti HTML in PDF finale ottimizzato
            this.showMessage('Conversione HTML→PDF finale ottimizzato...', 'info');
            await this.generatePDFFromHTML();

            this.showMessage('Export completato! Excel e PDF finale ottimizzato scaricati con successo.', 'success');

        } catch (error) {
            console.error('Export error:', error);
            this.showMessage(`Errore durante l'export: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
       // VERSIONE FINALE OTTIMIZZATA: Occupa completamente il foglio A4 landscape
    generateExcelReplicaHTML() {
        const currentDate = new Date().toLocaleDateString('it-IT');
        const currentTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        // Raccoglie i dati
        const flightSpeed = document.getElementById('flightSpeed')?.value || 90;
        const fuelConsumption = document.getElementById('fuelConsumption')?.value || 30;

        // Calcola totali
        const totalDistance = this.flightData.flightResults.reduce((s, r) => s + (r.distance || 0), 0);
        const totalFlightTime = this.flightData.flightResults.reduce((s, r) => s + (r.flightTime || 0), 0);
        const totalFuel = this.flightData.fuelData.totalFuel || 0;

        let html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>VFR Flight Plan - A4 Landscape Full</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 6mm;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Arial', sans-serif;
            font-size: 9px;
            line-height: 1.1;
            color: #000;
            background: #fff;
            width: 100%;
            height: 100vh;
            overflow: hidden;
        }

        /* Container che sfrutta TUTTO l'A4 disponibile */
        .flight-plan-container {
            width: 100%;
            max-width: 285mm;               /* A4 landscape - margini 6mm */
            height: 198mm;                  /* A4 height - margini 6mm */
            margin: 0 auto;
            background: #fff;
            border: 1px solid #000;         /* Bordo sottile per più spazio */
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }

        /* Header compatto */
        .main-header {
            text-align: center;
            background: #1e40af;
            color: white;
            padding: 3px;                   /* Ridotto per più spazio */
            font-size: 14px;                /* Leggibile ma compatto */
            font-weight: bold;
            border-bottom: 1px solid #000;  /* Bordo sottile */
            flex-shrink: 0;
        }

        /* Info generali compatte */
        .flight-info {
            display: flex;
            justify-content: space-between;
            padding: 2px 6px;               /* Compatto */
            background: #f8fafc;
            border-bottom: 1px solid #ccc;
            font-size: 8px;                 /* Font compatto */
            height: 16px;                   /* Altezza fissa ridotta */
            flex-shrink: 0;
        }

        .info-left, .info-center, .info-right {
            flex: 1;
            font-weight: 600;
        }

        /* Sezione note ottimizzata */
        .notes-section {
            margin: 1px 4px;               /* Margini ridotti */
            padding: 4px;
            background: #f9f9f9;
            border: 1px solid #666;
            height: 45px;                   /* Altezza bilanciata */
            flex-shrink: 0;
        }

        .notes-label {
            font-size: 8px;                /* Font compatto */
            font-weight: bold;
            color: #333;
        }

        .notes-lines {
            margin-top: 8px;
            background-image: repeating-linear-gradient(
                transparent,
                transparent 8px,
                #ddd 8px,
                #ddd 9px
            );
            height: 30px;                   /* Spazio per scrittura */
        }

        /* Layout principale che prende tutto lo spazio rimanente */
        .main-layout {
            display: flex;
            gap: 6px;
            padding: 1px 4px;               /* Padding ridotto */
            flex: 1;                        /* ESPANDE per occupare tutto */
            min-height: 0;
        }

        /* Sezioni flight plan che si espandono */
        .main-section, .alternate-section {
            flex: 1;
            border: 1px solid #000;         /* Bordo sottile */
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        /* Header sezioni compatti */
        .section-title {
            background: #1e40af;
            color: white;
            text-align: center;
            font-weight: bold;
            font-size: 10px;                /* Font leggibile */
            padding: 2px;
            border-bottom: 1px solid #000;
            flex-shrink: 0;
        }

        /* Tabelle che si espandono per riempire tutto lo spazio */
        .flight-table {
            width: 100%;
            border-collapse: collapse;
            flex: 1;                        /* SI ESPANDE per riempire tutto */
            font-size: 9px;                 /* Font leggibile */
            table-layout: fixed;            /* Layout fisso per controllo */
        }

        .flight-table th {
            background: #3b82f6;
            color: white;
            font-weight: bold;
            font-size: 9px;
            padding: 2px;
            text-align: center;
            border: 1px solid #000;
            height: 18px;                   /* Header proporzionato */
        }

        /* CELLE PRINCIPALI CON ALTEZZA AUMENTATA */
        .flight-table td {
            border: 1px solid #666;
            padding: 2px;
            text-align: center;
            font-size: 9px;                 /* Font leggibile */
            height: 22px;                   /* ALTEZZA AUMENTATA per occupare spazio */
            vertical-align: middle;
            font-weight: 500;
            white-space: nowrap;            /* Evita wrapping */
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .waypoint-name {
            text-align: left !important;
            font-weight: bold;
            padding-left: 3px;
            font-size: 9px;
        }

        .time-column {
            background: #f0f9ff;
            font-weight: 600;
        }

        /* Sezione bottom bilanciata */
        .bottom-section {
            display: flex;
            gap: 6px;
            margin-top: 1px;                /* Margine minimo */
            height: 75px;                   /* Altezza fissa adeguata */
            padding: 0 4px;
            flex-shrink: 0;
        }

        .fuel-summary, .block-times {
            flex: 1;
            border: 1px solid #000;         /* Bordo sottile */
        }

        .fuel-summary table, .block-times table {
            width: 100%;
            border-collapse: collapse;
            height: 100%;
        }

        .fuel-summary th, .block-times th {
            background: #1e40af;
            color: white;
            padding: 2px;
            font-size: 9px;                 /* Font leggibile */
            text-align: center;
            border: 1px solid #000;
        }

        .fuel-summary td, .block-times td {
            padding: 2px 3px;
            border: 1px solid #666;
            font-size: 9px;                 /* Font leggibile */
            height: auto;
        }

        .fuel-label {
            text-align: left;
            font-weight: bold;
            background: #f8fafc;
            font-size: 8px;
        }

        .fuel-value {
            text-align: center;
            font-weight: bold;
            font-size: 9px;
        }

        /* Footer minimo */
        .footer-info {
            margin-top: 1px;
            padding: 1px;
            font-size: 6px;                 /* Font minimo */
            color: #666;
            text-align: center;
            border-top: 1px solid #ccc;
            flex-shrink: 0;
        }

        /* Regole print per A4 */
        @media print {
            body { 
                margin: 0; 
                overflow: visible; 
            }
            .flight-plan-container { 
                page-break-inside: avoid;
                max-width: 100%;
                height: 100vh;
            }
            @page { 
                size: A4 landscape;
                margin: 6mm;
            }
        }
    </style>
</head>
<body>
    <div class="flight-plan-container">

        <!-- Header -->
        <div class="main-header">
            VFR FLIGHT PLAN - PIANO DI VOLO VFR (FULL A4)
        </div>

        <!-- Info Generali -->
        <div class="flight-info">
            <div class="info-left">
                <strong>Data:</strong> ${currentDate} | <strong>Ora:</strong> ${currentTime}
            </div>
            <div class="info-center">
                <strong>Velocità:</strong> ${flightSpeed} kt | <strong>Consumo:</strong> ${fuelConsumption} l/h
            </div>
            <div class="info-right">
                <strong>Distanza Tot:</strong> ${Math.round(totalDistance * 10) / 10} NM | 
                <strong>Tempo Tot:</strong> ${Math.round(totalFlightTime)} min
            </div>
        </div>

        <!-- Sezione Note -->
        <div class="notes-section">
            <div class="notes-label">NOTES / NOTE:</div>
            <div class="notes-lines"></div>
        </div>

        <!-- Layout Principale che occupa tutto lo spazio rimanente -->
        <div class="main-layout">

            <!-- Main Flight Plan -->
            <div class="main-section">
                <div class="section-title">MAIN FLIGHT PLAN</div>
                <table class="flight-table">
                    <thead>
                        <tr>
                            <th style="width: 18%;">FIX</th>
                            <th style="width: 9%;">Route</th>
                            <th style="width: 9%;">Alt[Ft]</th>
                            <th style="width: 9%;">Dist[NM]</th>
                            <th style="width: 9%;">Radial</th>
                            <th style="width: 9%;">Time[min]</th>
                            <th style="width: 11%;">ETO</th>
                            <th style="width: 11%;">ATO</th>
                            <th style="width: 11%;">RETO</th>
                        </tr>
                    </thead>
                    <tbody>`;

        // Genera 12 righe per occupare più spazio
        const maxMainRows = 12;
        for (let i = 0; i < maxMainRows; i++) {
            html += `<tr>`;
            if (this.flightData.flightResults && i < this.flightData.flightResults.length) {
                const result = this.flightData.flightResults[i];
                html += `
                    <td class="waypoint-name">${result.fix.split(',')[0]}</td>
                    <td>${i > 0 ? Math.round(parseFloat(result.route) || 0) : '---'}</td>
                    <td>${Math.round(result.altitude || 0)}</td>
                    <td>${i > 0 ? Math.round(result.distance || 0) : '---'}</td>
                    <td>${i > 0 ? Math.round(parseFloat(result.radial) || 0) : '---'}</td>
                    <td>${i > 0 ? Math.round(result.flightTime || 0) : '---'}</td>
                    <td class="time-column">____</td>
                    <td class="time-column">____</td>
                    <td class="time-column">____</td>
                `;
            } else {
                html += `<td></td><td></td><td></td><td></td><td></td><td></td>
                        <td class="time-column">____</td><td class="time-column">____</td><td class="time-column">____</td>`;
            }
            html += `</tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>

            <!-- Alternate Airport -->
            <div class="alternate-section">
                <div class="section-title">ALTERNATE AIRPORT</div>
                <table class="flight-table">
                    <thead>
                        <tr>
                            <th style="width: 18%;">FIX ALT</th>
                            <th style="width: 9%;">Route</th>
                            <th style="width: 9%;">Alt[Ft]</th>
                            <th style="width: 9%;">Dist[NM]</th>
                            <th style="width: 9%;">Radial</th>
                            <th style="width: 9%;">Time[min]</th>
                            <th style="width: 11%;">ETO</th>
                            <th style="width: 11%;">ATO</th>
                            <th style="width: 11%;">RETO</th>
                        </tr>
                    </thead>
                    <tbody>`;

        // Genera 12 righe per alternate
        const maxAltRows = 12;
        for (let i = 0; i < maxAltRows; i++) {
            html += `<tr>`;
            if (this.flightData.alternateResults && i < this.flightData.alternateResults.length) {
                const altResult = this.flightData.alternateResults[i];
                html += `
                    <td class="waypoint-name">${altResult.fix.split(',')[0]}</td>
                    <td>${i > 0 ? Math.round(parseFloat(altResult.route) || 0) : '---'}</td>
                    <td>${Math.round(altResult.altitude || 0)}</td>
                    <td>${i > 0 ? Math.round(altResult.distance || 0) : '---'}</td>
                    <td>${i > 0 ? Math.round(parseFloat(altResult.radial) || 0) : '---'}</td>
                    <td>${i > 0 ? Math.round(altResult.flightTime || 0) : '---'}</td>
                    <td class="time-column">____</td>
                    <td class="time-column">____</td>
                    <td class="time-column">____</td>
                `;
            } else {
                html += `<td></td><td></td><td></td><td></td><td></td><td></td>
                        <td class="time-column">____</td><td class="time-column">____</td><td class="time-column">____</td>`;
            }
            html += `</tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Sezione Bottom -->
        <div class="bottom-section">
            <div class="fuel-summary">
                <table>
                    <thead><tr><th colspan="2">FUEL CALCULATION</th></tr></thead>
                    <tbody>
                        <tr><td class="fuel-label">Trip Fuel:</td><td class="fuel-value">${this.flightData.fuelData.tripFuel || 0} L</td></tr>
                        <tr><td class="fuel-label">Alternate Fuel:</td><td class="fuel-value">${this.flightData.alternateFuelData.alternateFuel || 0} L</td></tr>
                        <tr><td class="fuel-label">Contingency (5%):</td><td class="fuel-value">${this.flightData.fuelData.contingencyFuel || 0} L</td></tr>
                        <tr><td class="fuel-label">Reserve (45min):</td><td class="fuel-value">${this.flightData.fuelData.reserveFuel || 0} L</td></tr>
                        <tr style="background: #fef3c7;"><td class="fuel-label"><strong>TOTAL REQUIRED:</strong></td><td class="fuel-value"><strong>${totalFuel} L</strong></td></tr>
                        <tr><td class="fuel-label">Fuel on Board:</td><td class="fuel-value">_____ L</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="block-times">
                <table>
                    <thead><tr><th colspan="2">BLOCK TIMES</th></tr></thead>
                    <tbody>
                        <tr><td class="fuel-label">Block Out:</td><td class="fuel-value">_____</td></tr>
                        <tr><td class="fuel-label">Block In:</td><td class="fuel-value">_____</td></tr>
                        <tr><td class="fuel-label">Block Time:</td><td class="fuel-value">_____ min</td></tr>
                        <tr><td class="fuel-label">Total Flight:</td><td class="fuel-value"><strong>${Math.round(totalFlightTime)} min</strong></td></tr>
                        <tr><td class="fuel-label">Total Distance:</td><td class="fuel-value"><strong>${Math.round(totalDistance * 10) / 10} NM</strong></td></tr>
                        <tr><td class="fuel-label">Avg Ground Speed:</td><td class="fuel-value">${totalFlightTime > 0 ? Math.round(totalDistance / (totalFlightTime/60) * 10) / 10 : 0} kt</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer-info">
            VFR Flight Planner (Full A4) - ${currentDate} ${currentTime}
        </div>

    </div>
</body>
</html>`;

        return html;
    }

    // FUNZIONE: Converte HTML in PDF tramite API finale ottimizzata
    async generatePDFFromHTML() {
        try {
            if (!this.lastGeneratedHTML) {
                throw new Error('Nessun HTML generato - errore interno');
            }

            console.log('Calling HTML to PDF API (FINAL OPTIMIZED A4)...');

            const response = await fetch('/api/html-to-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    htmlContent: this.lastGeneratedHTML
                })
            });

            if (!response.ok) {
                let errorMessage = 'Errore API PDF';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `HTTP ${response.status}`;
                } catch (e) {
                    errorMessage = `HTTP Error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            console.log('PDF FINAL OPTIMIZED A4 response received, downloading...');

            const pdfBlob = await response.blob();

            if (pdfBlob.size === 0) {
                throw new Error('PDF vuoto ricevuto dal server');
            }

            // Download PDF finale ottimizzato
            this.downloadBlob(pdfBlob, 'VFR-Flight-Plan-Final.pdf');

            console.log('PDF FINAL OPTIMIZED A4 downloaded successfully');

        } catch (error) {
            console.error('PDF Generation Error:', error);
            throw new Error(`Errore conversione HTML→PDF: ${error.message}`);
        }
    }

    // FUNZIONE ESISTENTE MANTENUTA: Export Excel con template
    async exportToExcelWithTemplate() {
        try {
            // Load template Excel file from repository root (TemplateFlightLog.xlsx)
            const response = await fetch('TemplateFlightLog.xlsx');
            if (!response.ok) {
                throw new Error(`Failed to load Excel template: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();

            const workbook = new ExcelJS.Workbook();
            // Preserve styles by loading the template and only changing cell values
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.getWorksheet(1);

            // Fill main waypoints data - starting from A11
            if (this.flightData.flightResults && this.flightData.flightResults.length > 0) {
                this.flightData.flightResults.forEach((result, index) => {
                    const row = 11 + index;
                    // Put FIX name in column A for every row
                    worksheet.getCell(`A${row}`).value = result.fix.split(',')[0];

                    // For rows after the first, fill B-F (same logic as your python code)
                    if (index > 0) {
                        worksheet.getCell(`B${row}`).value = Math.ceil(parseFloat(result.route) || 0);
                        worksheet.getCell(`C${row}`).value = Math.ceil(result.altitude || 0);
                        worksheet.getCell(`D${row}`).value = Math.ceil(result.distance || 0);
                        worksheet.getCell(`E${row}`).value = Math.ceil(parseFloat(result.radial) || 0);
                        worksheet.getCell(`F${row}`).value = Math.ceil(result.flightTime || 0);
                    }
                });

                // Block times totals A26, C26, F26, H26, I26
                const totalDistance = this.flightData.flightResults.reduce((s, r) => s + (r.distance || 0), 0);
                const totalFlightTime = this.flightData.flightResults.reduce((s, r) => s + (r.flightTime || 0), 0);

                worksheet.getCell('A26').value = 'Block in';
                worksheet.getCell('C26').value = 'Block out';
                worksheet.getCell('F26').value = Math.round(totalDistance*10)/10;
                worksheet.getCell('H26').value = 'Block time';
                worksheet.getCell('I26').value = Math.round(totalFlightTime*10)/10;
            }

            // Fill fuel data (O21, O23, O24)
            if (this.flightData.fuelData) {
                worksheet.getCell('O21').value = this.flightData.fuelData.tripFuel || 0;
                worksheet.getCell('O23').value = this.flightData.fuelData.contingencyFuel || 0;
                worksheet.getCell('O24').value = this.flightData.fuelData.reserveFuel || 0;
            }

            // Fill alternate data if exists - starting from K11
            if (this.flightData.alternateResults && this.flightData.alternateResults.length > 0) {
                this.flightData.alternateResults.forEach((result, index) => {
                    const row = 11 + index;
                    worksheet.getCell(`K${row}`).value = result.fix.split(',')[0];

                    if (index > 0) {
                        worksheet.getCell(`L${row}`).value = Math.ceil(parseFloat(result.route) || 0);
                        worksheet.getCell(`M${row}`).value = Math.ceil(result.altitude || 0);
                        worksheet.getCell(`N${row}`).value = Math.ceil(result.distance || 0);
                        worksheet.getCell(`O${row}`).value = Math.ceil(parseFloat(result.radial) || 0);
                        worksheet.getCell(`P${row}`).value = Math.ceil(result.flightTime || 0);
                    }
                });

                // Alternate trip fuel O22 if computed
                if (this.flightData.alternateFuelData) {
                    worksheet.getCell('O22').value = this.flightData.alternateFuelData.alternateFuel || 0;
                }
            }

            // Generate and download (preserve template formatting)
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // IMPORTANTE: Salva il blob per uso futuro se necessario
            this.lastExcelBlob = blob;

            this.downloadBlob(blob, 'VFR-Flight-Plan.xlsx');

        } catch (error) {
            console.error('Excel template export error:', error);
            // Fallback to basic Excel export if template fails
            await this.exportToBasicExcel();
        }
    }

    // UTILITY: Download blob helper
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== UI UPDATE FUNCTIONS =====

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

        // Reset fuel display
        ['tripFuel', 'contingencyFuel', 'reserveFuel', 'totalFuel', 'alternateFuel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-- litri';
        });

        // Reset form values
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

    // ===== WEIGHT & BALANCE METHODS (COMPLETI) =====

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

    initializeWeightBalanceChart() {
        const canvas = document.getElementById('wbChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.weightBalanceData.chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'W&B Envelope',
                    data: this.weightBalanceData.envelope,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    showLine: true,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#1FB8CD'
                }, {
                    label: 'Aircraft Position',
                    data: [],
                    backgroundColor: '#DB4545',
                    borderColor: '#DB4545',
                    pointRadius: 8,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Weight (kg)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Moment'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
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

        // Update totals
        const totalWeightEl = document.getElementById('totalWeight');
        const totalArmEl = document.getElementById('totalArm');
        const totalMomentEl = document.getElementById('totalMoment');

        if (totalWeightEl) totalWeightEl.textContent = Math.round(totalWeight * 100) / 100;
        if (totalArmEl) totalArmEl.textContent = totalWeight > 0 ? Math.round((totalMoment / totalWeight) * 1000) / 1000 : 0;
        if (totalMomentEl) totalMomentEl.textContent = Math.round(totalMoment * 100) / 100;

        // Update chart
        this.updateWeightBalanceChart(totalWeight, totalMoment);

        // Check if within envelope
        this.checkWeightBalanceEnvelope(totalWeight, totalMoment);

        this.showMessage('Calcoli Weight & Balance completati', 'success');
    }

    updateWeightBalanceChart(weight, moment) {
        if (!this.weightBalanceData.chart) return;
        this.weightBalanceData.chart.data.datasets[1].data = [{ x: weight, y: moment }];
        this.weightBalanceData.chart.update();
    }

    checkWeightBalanceEnvelope(weight, moment) {
        const isInside = this.pointInPolygon([weight, moment], this.weightBalanceData.envelope);
        const statusDiv = document.getElementById('wbStatus');
        if (!statusDiv) return;

        if (isInside) {
            statusDiv.textContent = 'WITHIN W&B RANGE';
            statusDiv.className = 'inside-range';
        } else {
            statusDiv.textContent = 'OUTSIDE W&B RANGE';
            statusDiv.className = 'outside-range';
        }
    }

    pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
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
        const wbStatus = document.getElementById('wbStatus');

        if (totalWeightEl) totalWeightEl.textContent = '0';
        if (totalArmEl) totalArmEl.textContent = '0';
        if (totalMomentEl) totalMomentEl.textContent = '0';
        if (wbStatus) {
            wbStatus.textContent = '';
            wbStatus.className = '';
        }

        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.data.datasets[1].data = [];
            this.weightBalanceData.chart.update();
        }

        this.showMessage('Weight & Balance resettato', 'success');
    }

    createWBRangeInputs() {
        const container = document.getElementById('wbRangeInputs');
        if (!container) return;
        container.innerHTML = '';

        this.weightBalanceData.envelope.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'wb-range-input';
            div.innerHTML = `
                <label>Punto ${index + 1}</label>
                <input type="number" class="form-control aviation-input" id="wbWeight${index}" 
                       value="${point[0]}" placeholder="Peso">
                <input type="number" class="form-control aviation-input" id="wbMoment${index}" 
                       value="${point[1]}" placeholder="Momento">
            `;
            container.appendChild(div);
        });
    }

    showWBRangeModal() {
        this.createWBRangeInputs();
        const modalEl = document.getElementById('wbRangeModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    saveWBRange() {
        const newEnvelope = [];
        for (let i = 0; i < 5; i++) {
            const weightInput = document.getElementById(`wbWeight${i}`);
            const momentInput = document.getElementById(`wbMoment${i}`);
            const weight = parseFloat(weightInput ? weightInput.value : 0);
            const moment = parseFloat(momentInput ? momentInput.value : 0);

            if (isNaN(weight) || isNaN(moment)) {
                this.showMessage('Tutti i valori devono essere numerici', 'error');
                return;
            }
            newEnvelope.push([weight, moment]);
        }

        this.weightBalanceData.envelope = newEnvelope;
        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.data.datasets[0].data = newEnvelope;
            this.weightBalanceData.chart.update();
        }

        const modalEl = document.getElementById('wbRangeModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        this.showMessage('Envelope aggiornato con successo', 'success');
    }

    // ===== UTILITY METHODS =====

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (!modal) return;

        if (show) {
            new bootstrap.Modal(modal).show();
        } else {
            const instance = bootstrap.Modal.getInstance(modal);
            if (instance) instance.hide();
        }
    }

    showMessage(message, type) {
        // Create a temporary alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'info' ? 'info' : 'warning'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.flightPlanner = new VFRFlightPlanner();
});
