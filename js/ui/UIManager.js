import { Autocomplete } from './Autocomplete.js';
import { ChartController } from './ChartController.js';
import { WeatherManager } from './WeatherManager.js';
import { Calculator } from '../services/Calculator.js';
import { GeocodingService } from '../services/GeocodingService.js';
import { ExportService } from '../services/ExportService.js';

export class UIManager {
    constructor(flightData, aircraft) {
        this.flightData = flightData;
        this.aircraft = aircraft;
        this.autocomplete = new Autocomplete();
        this.chartController = new ChartController();
        this.weatherManager = new WeatherManager();
        this.customModeEnabled = false;
    }

    init() {
        this.bindEvents();
        this.initializeWeightBalanceTable();
        this.addWaypointInputs();

        // Weather Manager is self-initializing in its constructor (event listeners)

        // Initialize Chart when tab is shown
        const wbTab = document.getElementById('wb-tab');
        if (wbTab) {
            wbTab.addEventListener('click', () => {
                setTimeout(() => {
                    if (!this.chartController.chart) {
                        this.initializeWeightBalanceChart();
                    }
                }, 100);
            });
        }
    }

    bindEvents() {
        // Aircraft selection
        const aircraftSelect = document.getElementById('aircraftSelect');
        if (aircraftSelect) {
            aircraftSelect.addEventListener('change', (e) => {
                this.aircraft.loadAircraftData(e.target.value);
                this.initializeWeightBalanceTable();
                this.resetWeightBalance();
                if (this.chartController.chart) {
                    this.updateWeightBalanceLabels();
                }
            });
        }

        // Custom mode
        const customModeCheckbox = document.getElementById('customModeCheckbox');
        if (customModeCheckbox) {
            customModeCheckbox.addEventListener('change', (e) => {
                this.customModeEnabled = e.target.checked;
                this.toggleCustomMode(e.target.checked);
                this.initializeWeightBalanceTable();
            });
        }

        // Flight Planning
        document.getElementById('addWaypoints')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.addWaypointInputs();
        });

        document.getElementById('addAlternateWaypoints')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.addAlternateWaypointInputs();
        });

        document.getElementById('calculateFlight')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.calculateFlightData();
        });

        document.getElementById('resetPlan')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.resetFlightPlan();
        });

        document.getElementById('exportPlan')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportExcelAndPDF();
        });

        document.getElementById('includeAlternate')?.addEventListener('change', (e) => {
            this.toggleAlternateSection(e.target.checked);
        });

        // Weight & Balance
        document.getElementById('calculateWB')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.calculateWeightBalance();
        });

        document.getElementById('resetWB')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.resetWeightBalance();
        });

        document.getElementById('updateWBRange')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showWBRangeModal();
        });

        document.getElementById('saveWBRange')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveWBRange();
        });

        document.getElementById('saveCustomArms')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveCustomArms();
        });
    }

    // ... (rest of the methods adapted from app.js)
    // I will implement the rest of the methods in the next steps or in one go if possible.
    // Since the file is large, I'll write the skeleton and then fill it in or write it all at once if it fits.
    // I'll try to write the full content.

    toggleCustomMode(enabled) {
        const updateWBBtn = document.getElementById('updateWBRange');
        if (updateWBBtn) {
            updateWBBtn.textContent = enabled ? 'Edit Envelope & Arms' : 'Update W&B Range';
        }
    }

    addWaypointInputs() {
        const numWaypointsInput = document.getElementById('numWaypoints');
        if (!numWaypointsInput) return;

        const numWaypoints = parseInt(numWaypointsInput.value) || 2;
        const container = document.getElementById('waypointInputs');
        if (!container) return;

        if (numWaypoints < 2 || numWaypoints > 15) {
            this.showMessage('Il numero di waypoint deve essere tra 2 e 15', 'error');
            numWaypointsInput.value = Math.max(2, Math.min(15, numWaypoints));
            return;
        }

        container.innerHTML = '';
        for (let i = 0; i < numWaypoints; i++) {
            const div = document.createElement('div');
            div.className = 'waypoint-input';
            div.innerHTML = `
                <label>Waypoint ${i + 1}:</label>
                <input type="text" class="form-control aviation-input waypoint-input" 
                    id="waypoint${i}" placeholder="Insert waypoint ${i + 1}" autocomplete="off">
            `;
            container.appendChild(div);

            const input = div.querySelector(`#waypoint${i}`);
            if (input) {
                this.autocomplete.setup(input);
            }
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
                <label>Alternate Waypoint ${i + 1}:</label>
                <input type="text" class="form-control aviation-input waypoint-input" 
                    id="alternateWaypoint${i}" placeholder="Insert alternate waypoint ${i + 1}" autocomplete="off">
            `;
            container.appendChild(div);

            const input = div.querySelector(`#alternateWaypoint${i}`);
            if (input) {
                this.autocomplete.setup(input);
            }
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
            const numWaypoints = parseInt(numWaypointsInput.value) || 2;
            const waypoints = [];

            for (let i = 0; i < numWaypoints; i++) {
                const input = document.getElementById(`waypoint${i}`);
                if (!input) continue;
                const value = input.value.trim();
                if (!value) throw new Error(`Waypoint ${i + 1} è obbligatorio`);
                waypoints.push(value);
            }

            if (waypoints.length === 0) throw new Error('Inserire almeno un waypoint');

            this.showMessage('Geocodificazione waypoints in corso...', 'info');
            const geocodedWaypoints = await this.geocodeWaypoints(waypoints, 'waypoint');
            this.flightData.waypoints = geocodedWaypoints;

            this.showMessage('Calcolo rotta in corso...', 'info');
            this.flightData.flightResults = await this.calculateRoute(geocodedWaypoints);

            const fuelConsumption = parseFloat(document.getElementById('fuelConsumption')?.value || 30);
            this.flightData.fuelData = Calculator.calculateFuel(this.flightData.flightResults, fuelConsumption);

            const alternateCheckbox = document.getElementById('includeAlternate');
            if (alternateCheckbox && alternateCheckbox.checked) {
                this.showMessage('Calcolo rotta alternata in corso...', 'info');
                await this.calculateAlternateRoute();
            }

            this.updateFlightTable();
            this.updateFuelDisplay();

            const exportBtn = document.getElementById('exportPlan');
            if (exportBtn) exportBtn.disabled = false;

            this.showMessage('Calcoli completati con successo!', 'success');

        } catch (error) {
            console.error('Calculation error:', error);
            this.showMessage(`Errore: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async geocodeWaypoints(waypoints, inputPrefix) {
        const geocoded = [];
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            try {
                let coords = { lat: null, lon: null };
                const inputElement = document.getElementById(`${inputPrefix}${i}`);

                if (inputElement && inputElement.dataset.lat && inputElement.dataset.lon) {
                    coords.lat = parseFloat(inputElement.dataset.lat);
                    coords.lon = parseFloat(inputElement.dataset.lon);
                } else {
                    const query = `${waypoint}, Italia`;
                    coords = await GeocodingService.geocodeWithNominatim(query);
                }

                const elevation = await GeocodingService.getElevation(coords.lat, coords.lon);
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

    async calculateRoute(waypoints) {
        const results = [];
        const flightSpeed = parseFloat(document.getElementById('flightSpeed')?.value || 90);

        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            let distance = 0;
            let heading = 0;
            let radial = 0;

            if (i > 0) {
                const prevWaypoint = waypoints[i - 1];
                distance = Calculator.calculateDistance(prevWaypoint.lat, prevWaypoint.lon, waypoint.lat, waypoint.lon);
                heading = Calculator.calculateBearing(prevWaypoint.lat, prevWaypoint.lon, waypoint.lat, waypoint.lon);
            }

            if (i > 0 && waypoints.length > 0) {
                radial = Calculator.calculateBearing(waypoint.lat, waypoint.lon, waypoints[0].lat, waypoints[0].lon);
            }

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

    async calculateAlternateRoute() {
        const numAlternateWaypointsInput = document.getElementById('numAlternateWaypoints');
        if (!numAlternateWaypointsInput) return;

        const numWaypoints = parseInt(numAlternateWaypointsInput.value) || 2;
        const alternateWaypoints = [];

        for (let i = 0; i < numWaypoints; i++) {
            const input = document.getElementById(`alternateWaypoint${i}`);
            if (!input) continue;
            const value = input.value.trim();
            if (!value) throw new Error(`Alternate Waypoint ${i + 1} è obbligatorio`);
            alternateWaypoints.push(value);
        }

        if (alternateWaypoints.length === 0) throw new Error('Inserire almeno un waypoint alternato');

        const geocodedAlternateWaypoints = await this.geocodeWaypoints(alternateWaypoints, 'alternateWaypoint');
        this.flightData.alternateWaypoints = geocodedAlternateWaypoints;
        this.flightData.alternateResults = await this.calculateRoute(geocodedAlternateWaypoints);

        const fuelConsumption = parseFloat(document.getElementById('fuelConsumption')?.value || 30);
        const totalTime = this.flightData.alternateResults.reduce((sum, result) => sum + result.flightTime, 0);
        const alternateFuel = Math.round((totalTime * 0.01666 * fuelConsumption) * 10) / 10;
        this.flightData.alternateFuelData = { alternateFuel };

        this.updateAlternateTable();
        this.updateAlternateFuelDisplay();
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

    updateFuelDisplay() {
        document.getElementById('tripFuel').textContent = `${this.flightData.fuelData.tripFuel || 0} litri`;
        document.getElementById('contingencyFuel').textContent = `${this.flightData.fuelData.contingencyFuel || 0} litri`;
        document.getElementById('reserveFuel').textContent = `${this.flightData.fuelData.reserveFuel || 0} litri`;
        document.getElementById('totalFuel').textContent = `${this.flightData.fuelData.totalFuel || 0} litri`;
    }

    updateAlternateTable() {
        const tbody = document.getElementById('alternateTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (this.flightData.alternateResults && this.flightData.alternateResults.length > 0) {
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
            document.getElementById('alternateCard').style.display = 'block';
        }
    }

    updateAlternateFuelDisplay() {
        const alternateFuelEl = document.getElementById('alternateTripFuel');
        if (alternateFuelEl) {
            alternateFuelEl.textContent = `${this.flightData.alternateFuelData.alternateFuel || 0} litri`;
        }
    }

    resetFlightPlan() {
        this.flightData.reset();
        document.getElementById('flightTableBody').innerHTML = '';
        document.getElementById('alternateTableBody').innerHTML = '';
        document.getElementById('alternateCard').style.display = 'none';
        document.getElementById('includeAlternate').checked = false;
        document.getElementById('alternateSection').style.display = 'none';

        this.updateFuelDisplay();
        this.updateAlternateFuelDisplay();

        const exportBtn = document.getElementById('exportPlan');
        if (exportBtn) exportBtn.disabled = true;

        this.showMessage('Piano di volo resettato', 'success');
    }

    async exportExcelAndPDF() {
        if (!this.flightData.flightResults || this.flightData.flightResults.length === 0) {
            this.showMessage('Nessun dato di volo da esportare', 'error');
            return;
        }

        try {
            this.showLoading(true);

            // Generiamo prima l'Excel
            this.showMessage('Generazione Excel in corso...', 'info');
            await ExportService.exportToExcel(this.flightData);
            await new Promise(resolve => setTimeout(resolve, 500)); // Piccolo delay per non sovrapporre i download

            // Poi generiamo il PDF
            this.showMessage('Generazione PDF in corso...', 'info');
            await ExportService.exportToPDF(this.flightData);

            this.showMessage('Export Excel e PDF completati con successo!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showMessage(`Errore durante l'export: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Weight & Balance
    initializeWeightBalanceTable() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
        const wbData = this.aircraft.weightBalanceData;

        wbData.categories.forEach((category, index) => {
            const row = tbody.insertRow();
            const armValue = wbData.arms[index];
            const weightValue = index === 0 && aircraftData.emptyWeight > 0 ? aircraftData.emptyWeight : 0;

            row.innerHTML = `
                <td>${category}</td>
                <td><input type="number" class="form-control aviation-input" id="weight${index}" value="${weightValue}" min="0" step="0.1"></td>
                <td>${this.customModeEnabled ?
                    `<input type="number" class="form-control aviation-input" id="arm${index}" value="${armValue}" step="0.001">` :
                    armValue}</td>
                <td><span id="moment${index}">0</span></td>
            `;
        });

        const totalRow = tbody.insertRow();
        totalRow.innerHTML = `
            <td><strong>Total</strong></td>
            <td><strong><span id="totalWeight">0</span></strong></td>
            <td><strong><span id="totalArm">0</span></strong></td>
            <td><strong><span id="totalMoment">0</span></strong></td>
        `;
    }

    initializeWeightBalanceChart() {
        const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
        this.chartController.initialize('wbChart', aircraftData, this.aircraft.weightBalanceData.envelope);
    }

    updateWeightBalanceLabels() {
        const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
        const weightHeader = document.getElementById('wbWeightHeader');
        const armHeader = document.getElementById('wbArmHeader');

        if (weightHeader && armHeader) {
            if (aircraftData.units === 'metric') {
                weightHeader.textContent = 'Weight[kg]';
                armHeader.textContent = 'Arm[m]';
            } else {
                weightHeader.textContent = 'Weight[lbs]';
                armHeader.textContent = 'Arm[inch]';
            }
        }

        this.chartController.update(this.aircraft.weightBalanceData.envelope, null, aircraftData);
    }

    calculateWeightBalance() {
        try {
            const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
            const wbData = this.aircraft.weightBalanceData;
            let totalWeight = 0;
            let totalMoment = 0;

            wbData.categories.forEach((category, index) => {
                const weightInput = document.getElementById(`weight${index}`);
                let armValue = wbData.arms[index];

                if (this.customModeEnabled) {
                    const armInput = document.getElementById(`arm${index}`);
                    if (armInput) {
                        armValue = parseFloat(armInput.value) || 0;
                        wbData.arms[index] = armValue;
                    }
                }

                if (!weightInput) return;

                let weight = parseFloat(weightInput.value) || 0;

                if (category.includes('Fuel') && aircraftData.units === 'imperial') {
                    weight = weight * aircraftData.fuelConversion;
                }

                let moment = weight * armValue;

                if (index === wbData.categories.length - 1 && aircraftData.landingGearMoment > 0) {
                    moment += aircraftData.landingGearMoment;
                }

                wbData.weights[index] = weight;
                wbData.moments[index] = moment;

                totalWeight += weight;
                totalMoment += moment;

                const momentSpan = document.getElementById(`moment${index}`);
                if (momentSpan) {
                    momentSpan.textContent = moment.toFixed(2);
                }
            });

            const finalArm = totalWeight > 0 ? totalMoment / totalWeight : 0;

            document.getElementById('totalWeight').textContent = totalWeight.toFixed(2);
            document.getElementById('totalArm').textContent = finalArm.toFixed(3);
            document.getElementById('totalMoment').textContent = totalMoment.toFixed(2);

            let chartPoint = {};
            if (aircraftData.name === 'P68B' || aircraftData.name === 'PA28') {
                chartPoint = { x: finalArm, y: totalWeight };
            } else {
                chartPoint = { x: totalMoment, y: totalWeight };
            }

            this.chartController.update(wbData.envelope, chartPoint, aircraftData);

            let checkX, checkY;
            if (aircraftData.name === 'P68B' || aircraftData.name === 'PA28') {
                checkX = finalArm;
                checkY = totalWeight;
            } else {
                checkX = totalMoment;
                checkY = totalWeight;
            }

            const isWithinLimits = this.aircraft.isPointInsidePolygon(checkX, checkY, wbData.envelope);
            const statusDiv = document.getElementById('wbStatus');
            if (statusDiv) {
                if (isWithinLimits) {
                    statusDiv.className = 'alert alert-success mt-2';
                    statusDiv.textContent = 'DENTRO I LIMITI - SAFE FOR FLIGHT';
                } else {
                    statusDiv.className = 'alert alert-danger mt-2';
                    statusDiv.textContent = 'FUORI LIMITI - NOT SAFE FOR FLIGHT';
                }
            }

            this.showMessage('Calcolo Weight & Balance completato', 'success');

        } catch (error) {
            console.error('Weight & Balance calculation error:', error);
            this.showMessage(`Errore: ${error.message}`, 'error');
        }
    }

    resetWeightBalance() {
        this.aircraft.loadAircraftData(this.aircraft.currentAircraft);
        this.initializeWeightBalanceTable();

        const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
        this.chartController.update(this.aircraft.weightBalanceData.envelope, null, aircraftData);

        const statusDiv = document.getElementById('wbStatus');
        if (statusDiv) {
            statusDiv.className = '';
            statusDiv.textContent = '';
        }
        this.showMessage('Weight & Balance resettato', 'success');
    }

    showWBRangeModal() {
        const modal = new bootstrap.Modal(document.getElementById('wbRangeModal'));
        const container = document.getElementById('wbRangeInputs');

        if (!container) return;
        container.innerHTML = '';

        this.aircraft.weightBalanceData.envelope.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            div.innerHTML = `
                <label>Point ${index + 1}:</label>
                <input type="number" class="form-control" id="envelopeX${index}" 
                    placeholder="X (Moment)" value="${point[0]}" step="0.1">
                <input type="number" class="form-control" id="envelopeY${index}" 
                    placeholder="Y (Weight)" value="${point[1]}" step="0.1">
            `;
            container.appendChild(div);
        });

        if (this.customModeEnabled) {
            const armsButton = document.createElement('button');
            armsButton.className = 'btn aviation-btn-secondary mt-3 w-100';
            armsButton.textContent = 'Edit Arm Values';
            armsButton.onclick = () => {
                modal.hide();
                this.showCustomArmsModal();
            };
            container.appendChild(armsButton);
        }

        modal.show();
    }

    showCustomArmsModal() {
        const modal = new bootstrap.Modal(document.getElementById('customArmsModal'));
        const container = document.getElementById('customArmsInputs');

        if (!container) return;
        container.innerHTML = '';

        this.aircraft.weightBalanceData.categories.forEach((category, index) => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            div.innerHTML = `
                <label>${category}:</label>
                <input type="number" class="form-control" id="customArm${index}" 
                    value="${this.aircraft.weightBalanceData.arms[index]}" step="0.001">
            `;
            container.appendChild(div);
        });

        modal.show();
    }

    saveWBRange() {
        try {
            const newEnvelope = [];
            for (let i = 0; i < this.aircraft.weightBalanceData.envelope.length; i++) {
                const xInput = document.getElementById(`envelopeX${i}`);
                const yInput = document.getElementById(`envelopeY${i}`);

                if (xInput && yInput) {
                    const x = parseFloat(xInput.value);
                    const y = parseFloat(yInput.value);
                    if (isNaN(x) || isNaN(y)) throw new Error(`Valori non validi per il punto ${i + 1}`);
                    newEnvelope.push([x, y]);
                }
            }

            this.aircraft.weightBalanceData.envelope = newEnvelope;
            const aircraftData = this.aircraft.getAircraft(this.aircraft.currentAircraft);
            this.chartController.update(newEnvelope, null, aircraftData);

            const modal = bootstrap.Modal.getInstance(document.getElementById('wbRangeModal'));
            if (modal) modal.hide();

            this.showMessage('Envelope aggiornato', 'success');
        } catch (error) {
            this.showMessage(`Errore: ${error.message}`, 'error');
        }
    }

    saveCustomArms() {
        try {
            this.aircraft.weightBalanceData.categories.forEach((category, index) => {
                const armInput = document.getElementById(`customArm${index}`);
                if (armInput) {
                    const armValue = parseFloat(armInput.value);
                    if (isNaN(armValue)) throw new Error(`Valore non valido per ${category}`);
                    this.aircraft.weightBalanceData.arms[index] = armValue;
                }
            });

            this.initializeWeightBalanceTable();
            const modal = bootstrap.Modal.getInstance(document.getElementById('customArmsModal'));
            if (modal) modal.hide();

            this.showMessage('Bracci aggiornati', 'success');
        } catch (error) {
            this.showMessage(`Errore: ${error.message}`, 'error');
        }
    }

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (!modal) return;
        const bsModal = show ? new bootstrap.Modal(modal) : bootstrap.Modal.getInstance(modal);
        if (show) bsModal.show();
        else bsModal && bsModal.hide();
    }

    showMessage(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        const container = document.querySelector('.container-fluid');
        if (container) container.insertBefore(alertDiv, container.firstChild);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}
