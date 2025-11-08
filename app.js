// VFR Flight Planner - Complete Multi-Aircraft Support v3.0.0
// Flight Planning + Multi-Aircraft Weight and Balance

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

        // Aircraft Database with complete specifications
        this.aircraftDatabase = {
            'TB9': {
                name: 'TB9',
                envelope: [[600,500], [1280,1060], [1100,1060], [910,980], [500,550]],
                emptyWeight: 0,
                arms: [1.006, 1.155, 2.035, 1.075, 2.6],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                units: 'metric',
                xLabel: 'Momentum [kg x m]',
                yLabel: 'Mass [kg]',
                fuelConversion: 0.72,
                landingGearMoment: 0
            },
            'TB10': {
                name: 'TB10',
                envelope: [[600,500], [1280,1060], [1100,1060], [910,980], [500,550]],
                emptyWeight: 727.37,
                arms: [1, 1.155, 2.035, 1.075, 2.6],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                units: 'metric',
                xLabel: 'Momentum [kg x m]',
                yLabel: 'Mass [kg]',
                fuelConversion: 0.72,
                landingGearMoment: 0
            },
            'PA28': {
                name: 'PA28',
                envelope: [[85.5,1400], [85.5,2250], [90,2780], [93,2780], [93,1400]],
                emptyWeight: 1824.44,
                arms: [89.48, 80.5, 118.1, 95, 142.9],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [liters]", "Luggage rack"],
                units: 'imperial',
                xLabel: 'Position CG [inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 819
            },
            'P68B': {
                name: 'P68B',
                envelope: [[10.2,2650], [10.2,3550], [12.8,4350], [20.6,4350], [20.6,2650]],
                emptyWeight: 2957.57,
                arms: [16.492, -37.4, -5.7, 34.2, 30.3, 60.7],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Passengers Row 1", "Passengers Row 2", "Fuel on Board [liters]", "Luggage"],
                units: 'imperial',
                xLabel: 'Position CG [inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 0
            }
        };

        // Current aircraft selection
        this.currentAircraft = 'TB9';
        this.customModeEnabled = false;

        // Weight and Balance data (populated from aircraft database)
        this.weightBalanceData = {
            envelope: [],
            arms: [],
            categories: [],
            weights: [],
            moments: [],
            chart: null
        };

        this.constants = {
            earthRadius: 6371,
            nauticalMileKm: 1.852,
            metersToFeet: 3.28084,
            baseAltitude: 1500
        };

        this.lastExcelBlob = null;
        this.lastGeneratedHTML = null;

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
        // Load initial aircraft data
        this.loadAircraftData(this.currentAircraft);

        // Bind all events
        this.bindEvents();

        // Initialize Weight Balance table
        this.initializeWeightBalanceTable();

        // Add default waypoint inputs
        this.addWaypointInputs();

        // Initialize Weight & Balance chart when tab is shown
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

    // ===== AIRCRAFT DATA MANAGEMENT =====
    loadAircraftData(aircraftCode) {
        const aircraft = this.aircraftDatabase[aircraftCode];
        if (!aircraft) {
            console.error('Aircraft not found:', aircraftCode);
            return;
        }

        this.currentAircraft = aircraftCode;
        this.weightBalanceData.envelope = JSON.parse(JSON.stringify(aircraft.envelope));
        this.weightBalanceData.arms = [...aircraft.arms];
        this.weightBalanceData.categories = [...aircraft.categories];

        const totalCategories = aircraft.categories.length + 1;
        this.weightBalanceData.weights = new Array(totalCategories).fill(0);
        this.weightBalanceData.moments = new Array(totalCategories).fill(0);

        if (aircraft.emptyWeight > 0) {
            this.weightBalanceData.weights[0] = aircraft.emptyWeight;
        }

        this.updateWeightBalanceLabels();
    }

    updateWeightBalanceLabels() {
        const aircraft = this.aircraftDatabase[this.currentAircraft];
        const weightHeader = document.getElementById('wbWeightHeader');
        const armHeader = document.getElementById('wbArmHeader');

        if (weightHeader && armHeader) {
            if (aircraft.units === 'metric') {
                weightHeader.textContent = 'Weight[kg]';
                armHeader.textContent = 'Arm[m]';
            } else {
                weightHeader.textContent = 'Weight[lbs]';
                armHeader.textContent = 'Arm[inch]';
            }
        }

        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.options.scales.x.title.text = aircraft.xLabel;
            this.weightBalanceData.chart.options.scales.y.title.text = aircraft.yLabel;
            this.weightBalanceData.chart.data.datasets[0].data = this.weightBalanceData.envelope;
            this.weightBalanceData.chart.update();
        }
    }

    // ===== EVENT BINDING =====
    bindEvents() {
        // Aircraft selection change
        const aircraftSelect = document.getElementById('aircraftSelect');
        if (aircraftSelect) {
            aircraftSelect.addEventListener('change', (e) => {
                this.loadAircraftData(e.target.value);
                this.initializeWeightBalanceTable();
                this.resetWeightBalance();
                if (this.weightBalanceData.chart) {
                    this.updateWeightBalanceLabels();
                }
            });
        }

        // Custom mode checkbox
        const customModeCheckbox = document.getElementById('customModeCheckbox');
        if (customModeCheckbox) {
            customModeCheckbox.addEventListener('change', (e) => {
                this.customModeEnabled = e.target.checked;
                this.toggleCustomMode(e.target.checked);
                this.initializeWeightBalanceTable();
            });
        }

        // ===== FLIGHT PLANNING EVENTS =====
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

        const exportBtn = document.getElementById('exportPlan');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportExcelAndPDF();
            });
        }

        const alternateCheckbox = document.getElementById('includeAlternate');
        if (alternateCheckbox) {
            alternateCheckbox.addEventListener('change', (e) => {
                this.toggleAlternateSection(e.target.checked);
            });
        }

        // ===== WEIGHT & BALANCE EVENTS =====
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

        const saveCustomArmsBtn = document.getElementById('saveCustomArms');
        if (saveCustomArmsBtn) {
            saveCustomArmsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveCustomArms();
            });
        }
    }

    toggleCustomMode(enabled) {
        const updateWBBtn = document.getElementById('updateWBRange');
        if (updateWBBtn) {
            updateWBBtn.textContent = enabled ? 'Edit Envelope & Arms' : 'Update W&B Range';
        }
    }

    // ===== AUTOCOMPLETE FUNCTIONS =====
    setupAutocomplete(inputElement) {
        let autocompleteTimeout = null;

        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'autocomplete-suggestions';
        autocompleteContainer.style.display = 'none';
        inputElement.parentElement.style.position = 'relative';
        inputElement.parentElement.appendChild(autocompleteContainer);

        inputElement.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            if (query.length < 2) {
                autocompleteContainer.style.display = 'none';
                return;
            }

            clearTimeout(autocompleteTimeout);
            autocompleteTimeout = setTimeout(async () => {
                try {
                    const suggestions = await this.getAutocompleteSuggestions(query);
                    this.displayAutocompleteSuggestions(suggestions, autocompleteContainer, inputElement);
                } catch (error) {
                    console.error('Autocomplete error:', error);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.style.display = 'none';
            }
        });
    }

    async getAutocompleteSuggestions(query) {
        try {
            const italianQuery = `${query}, Italia`;
            const italianResults = await this.searchLocation(italianQuery, true);

            let worldResults = [];
            if (italianResults.length < 3) {
                worldResults = await this.searchLocation(query, false);
            }

            const combined = [...italianResults, ...worldResults];
            const unique = this.removeDuplicateSuggestions(combined);
            return unique.slice(0, 5);
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    async searchLocation(query, prioritizeItaly) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'VFR Flight Planner App' }
            });
            if (!response.ok) return [];

            const data = await response.json();
            return data
                .filter(item => {
                    if (prioritizeItaly) {
                        return item.address && (
                            item.address.country === 'Italia' ||
                            item.address.country === 'Italy' ||
                            item.address.country_code === 'it'
                        );
                    }
                    return true;
                })
                .map(item => ({
                    name: item.display_name,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon),
                    shortName: this.getShortName(item)
                }));
        } catch (error) {
            console.error('Fetch error:', error);
            return [];
        }
    }

    getShortName(item) {
        if (item.address) {
            const parts = [];
            if (item.address.city) parts.push(item.address.city);
            else if (item.address.town) parts.push(item.address.town);
            else if (item.address.village) parts.push(item.address.village);
            else if (item.address.municipality) parts.push(item.address.municipality);
            if (item.address.province) parts.push(item.address.province);
            else if (item.address.state) parts.push(item.address.state);
            if (parts.length > 0) {
                return parts.join(', ');
            }
        }
        const displayName = item.display_name || '';
        const parts = displayName.split(',').slice(0, 2);
        return parts.join(',');
    }

    removeDuplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(suggestion => {
            const key = `${suggestion.lat.toFixed(4)},${suggestion.lon.toFixed(4)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    displayAutocompleteSuggestions(suggestions, container, inputElement) {
        if (suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        container.style.display = 'block';

        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = suggestion.shortName;
            div.title = suggestion.name;
            div.addEventListener('click', () => {
                inputElement.value = suggestion.shortName;
                container.style.display = 'none';
                inputElement.dataset.lat = suggestion.lat;
                inputElement.dataset.lon = suggestion.lon;
            });
            container.appendChild(div);
        });
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
                this.setupAutocomplete(input);
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
                this.setupAutocomplete(input);
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

    // ===== FLIGHT CALCULATION =====
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
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            try {
                let coords = { lat: null, lon: null };

                const inputElement = document.getElementById(`waypoint${i}`);
                if (inputElement && inputElement.dataset.lat && inputElement.dataset.lon) {
                    coords.lat = parseFloat(inputElement.dataset.lat);
                    coords.lon = parseFloat(inputElement.dataset.lon);
                } else {
                    const query = `${waypoint}, Italia`;
                    coords = await this.geocodeWithNominatim(query);
                }

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
            headers: { 'User-Agent': 'VFR Flight Planner App' }
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

    async geocodeAlternateWaypoints(waypoints) {
        const geocoded = [];
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            try {
                let coords = { lat: null, lon: null };

                const inputElement = document.getElementById(`alternateWaypoint${i}`);
                if (inputElement && inputElement.dataset.lat && inputElement.dataset.lon) {
                    coords.lat = parseFloat(inputElement.dataset.lat);
                    coords.lon = parseFloat(inputElement.dataset.lon);
                } else {
                    const query = `${waypoint}, Italia`;
                    coords = await this.geocodeWithNominatim(query);
                }

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

    calculateAlternateFuelData() {
        const totalTime = this.flightData.alternateResults.reduce((sum, result) => sum + result.flightTime, 0);
        const fuelConsumptionInput = document.getElementById('fuelConsumption');
        const fuelConsumption = parseFloat(fuelConsumptionInput ? fuelConsumptionInput.value : 30) || 30;

        const alternateFuel = Math.round((totalTime * 0.01666 * fuelConsumption) * 10) / 10;
        this.flightData.alternateFuelData = { alternateFuel };
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

        try {
            const geocodedAlternateWaypoints = await this.geocodeAlternateWaypoints(alternateWaypoints);
            this.flightData.alternateWaypoints = geocodedAlternateWaypoints;
            this.flightData.alternateResults = await this.calculateRoute(geocodedAlternateWaypoints);
            this.calculateAlternateFuelData();
            this.updateAlternateTable();
            this.updateAlternateFuelDisplay();
        } catch (error) {
            console.error('Alternate route calculation error:', error);
            throw error;
        }
    }

    // ===== EXPORT FUNCTIONS =====
    async exportExcelAndPDF() {
        if (!this.flightData.flightResults || this.flightData.flightResults.length === 0) {
            this.showMessage('Nessun dato di volo da esportare', 'error');
            return;
        }

        try {
            this.showLoading(true);
            this.showMessage('Generazione Excel in corso...', 'info');
            await this.exportToExcelWithTemplate();
            this.showMessage('Export Excel completato!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showMessage(`Errore durante l'export: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async exportToExcelWithTemplate() {
        try {
            const response = await fetch('TemplateFlightLog.xlsx');
            if (!response.ok) {
                throw new Error(`Failed to load Excel template: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.getWorksheet(1);

            if (this.flightData.flightResults && this.flightData.flightResults.length > 0) {
                this.flightData.flightResults.forEach((result, index) => {
                    const row = 11 + index;
                    worksheet.getCell(`A${row}`).value = result.fix.split(',')[0];
                    if (index > 0) {
                        worksheet.getCell(`B${row}`).value = Math.ceil(parseFloat(result.route) || 0);
                        worksheet.getCell(`C${row}`).value = Math.ceil(result.altitude || 0);
                        worksheet.getCell(`D${row}`).value = Math.ceil(result.distance || 0);
                        worksheet.getCell(`E${row}`).value = Math.ceil(parseFloat(result.radial) || 0);
                        worksheet.getCell(`F${row}`).value = Math.ceil(result.flightTime || 0);
                    }
                });

                const totalDistance = this.flightData.flightResults.reduce((s, r) => s + (r.distance || 0), 0);
                const totalFlightTime = this.flightData.flightResults.reduce((s, r) => s + (r.flightTime || 0), 0);
                worksheet.getCell('F26').value = Math.round(totalDistance * 10) / 10;
                worksheet.getCell('I26').value = Math.round(totalFlightTime * 10) / 10;
            }

            if (this.flightData.fuelData) {
                worksheet.getCell('O21').value = this.flightData.fuelData.tripFuel || 0;
                worksheet.getCell('O23').value = this.flightData.fuelData.contingencyFuel || 0;
                worksheet.getCell('O24').value = this.flightData.fuelData.reserveFuel || 0;
            }

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

                if (this.flightData.alternateFuelData) {
                    worksheet.getCell('O22').value = this.flightData.alternateFuelData.alternateFuel || 0;
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            this.lastExcelBlob = blob;
            this.downloadBlob(blob, 'VFR-Flight-Plan.xlsx');

        } catch (error) {
            console.error('Excel export error:', error);
            throw error;
        }
    }

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
        this.flightData.waypoints = [];
        this.flightData.alternateWaypoints = [];
        this.flightData.flightResults = [];
        this.flightData.alternateResults = [];
        this.flightData.fuelData = {};
        this.flightData.alternateFuelData = {};

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

    // ===== WEIGHT & BALANCE FUNCTIONS =====
    initializeWeightBalanceTable() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const aircraft = this.aircraftDatabase[this.currentAircraft];

        this.weightBalanceData.categories.forEach((category, index) => {
            const row = tbody.insertRow();
            const armValue = this.weightBalanceData.arms[index];
            const weightValue = index === 0 && aircraft.emptyWeight > 0 ? aircraft.emptyWeight : 0;

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
        const canvas = document.getElementById('wbChart');
        if (!canvas) return;

        const aircraft = this.aircraftDatabase[this.currentAircraft];
        const ctx = canvas.getContext('2d');

        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.destroy();
        }

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
                            text: aircraft.xLabel
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: aircraft.yLabel
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    calculateWeightBalance() {
        try {
            const aircraft = this.aircraftDatabase[this.currentAircraft];
            let totalWeight = 0;
            let totalMoment = 0;

            this.weightBalanceData.categories.forEach((category, index) => {
                const weightInput = document.getElementById(`weight${index}`);
                let armValue = this.weightBalanceData.arms[index];

                if (this.customModeEnabled) {
                    const armInput = document.getElementById(`arm${index}`);
                    if (armInput) {
                        armValue = parseFloat(armInput.value) || 0;
                        this.weightBalanceData.arms[index] = armValue;
                    }
                }

                if (!weightInput) return;

                let weight = parseFloat(weightInput.value) || 0;

                if (category.includes('Fuel') && aircraft.units === 'imperial') {
                    weight = weight * aircraft.fuelConversion;
                }

                let moment = weight * armValue;

                if (index === this.weightBalanceData.categories.length - 1 && aircraft.landingGearMoment > 0) {
                    moment += aircraft.landingGearMoment;
                }

                this.weightBalanceData.weights[index] = weight;
                this.weightBalanceData.moments[index] = moment;

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

            if (this.weightBalanceData.chart) {
                // For P68B and PA28: plot Mass vs Arm (x=arm, y=weight)
                // For TB9 and TB10: plot Mass vs Moment (x=moment, y=weight)
                const aircraft = this.aircraftDatabase[this.currentAircraft];
                let chartPoint = {};

                if (aircraft.name === 'P68B' || aircraft.name === 'PA28') {
                    // Plot: x = final arm (CG), y = weight
                    const finalArm = totalWeight > 0 ? totalMoment / totalWeight : 0;
                    chartPoint = {
                        x: finalArm,
                        y: totalWeight
                    };
                } else {
                    // TB9, TB10: plot x = moment, y = weight (original)
                    chartPoint = {
                        x: totalMoment,
                        y: totalWeight
                    };
                }

                this.weightBalanceData.chart.data.datasets[1].data = [chartPoint];
                this.weightBalanceData.chart.update();
            }

            // Determine which coordinates to use for polygon check
            let checkX, checkY;
            const aircraft = this.aircraftDatabase[this.currentAircraft];

            if (aircraft.name === 'P68B' || aircraft.name === 'PA28') {
                // For imperial units: use finalArm (CG) and totalWeight
                checkX = totalWeight > 0 ? totalMoment / totalWeight : 0;
                checkY = totalWeight;
            } else {
                // For metric units: use totalMoment and totalWeight
                checkX = totalMoment;
                checkY = totalWeight;
            }

            const isWithinLimits = this.isPointInsidePolygon(
                checkX, 
                checkY, 
                this.weightBalanceData.envelope
            );

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

    isPointInsidePolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    resetWeightBalance() {
        this.loadAircraftData(this.currentAircraft);
        this.initializeWeightBalanceTable();

        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.data.datasets[1].data = [];
            this.weightBalanceData.chart.update();
        }

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

        this.weightBalanceData.envelope.forEach((point, index) => {
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

        this.weightBalanceData.categories.forEach((category, index) => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            div.innerHTML = `
                <label>${category}:</label>
                <input type="number" class="form-control" id="customArm${index}" 
                    value="${this.weightBalanceData.arms[index]}" step="0.001">
            `;
            container.appendChild(div);
        });

        modal.show();
    }

    saveWBRange() {
        try {
            const newEnvelope = [];

            for (let i = 0; i < this.weightBalanceData.envelope.length; i++) {
                const xInput = document.getElementById(`envelopeX${i}`);
                const yInput = document.getElementById(`envelopeY${i}`);

                if (xInput && yInput) {
                    const x = parseFloat(xInput.value);
                    const y = parseFloat(yInput.value);

                    if (isNaN(x) || isNaN(y)) {
                        throw new Error(`Valori non validi per il punto ${i + 1}`);
                    }

                    newEnvelope.push([x, y]);
                }
            }

            this.weightBalanceData.envelope = newEnvelope;

            if (this.weightBalanceData.chart) {
                this.weightBalanceData.chart.data.datasets[0].data = newEnvelope;
                this.weightBalanceData.chart.update();
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('wbRangeModal'));
            if (modal) modal.hide();

            this.showMessage('Envelope aggiornato', 'success');

        } catch (error) {
            this.showMessage(`Errore: ${error.message}`, 'error');
        }
    }

    saveCustomArms() {
        try {
            this.weightBalanceData.categories.forEach((category, index) => {
                const armInput = document.getElementById(`customArm${index}`);

                if (armInput) {
                    const armValue = parseFloat(armInput.value);

                    if (isNaN(armValue)) {
                        throw new Error(`Valore non valido per ${category}`);
                    }

                    this.weightBalanceData.arms[index] = armValue;
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

    // ===== UTILITY FUNCTIONS =====
    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (!modal) return;

        const bsModal = show ? new bootstrap.Modal(modal) : bootstrap.Modal.getInstance(modal);
        if (show) {
            bsModal.show();
        } else {
            bsModal && bsModal.hide();
        }
    }

    showMessage(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }

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
