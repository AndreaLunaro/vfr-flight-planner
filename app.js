// VFR Flight Planner JavaScript Application - Multi-Aircraft Support v3.0.0
// Updated with TB9, TB10, PA28, P68B aircraft support + Custom Mode

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

        // Aircraft database with all specifications
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
                envelope: [[600,500], [920,980], [1250,1155], [1380,1555], [500,550]],
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
                envelope: [[85.5, 1400], [85.5, 2250], [90, 2780], [93, 2780], [93, 1400]],
                emptyWeight: 1824.44,
                arms: [89.48, 80.5, 118.1, 95, 142.9],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [liters]", "Luggage rack"],
                units: 'imperial',
                xLabel: 'Momentum [lbs x inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 819
            },
            'P68B': {
                name: 'P68B',
                envelope: [[10.2, 2650], [10.2, 3550], [12.8, 4350], [20.6, 4350], [20.6, 2650]],
                emptyWeight: 2957.57,
                arms: [16.492, -37.4, -5.7, 34.2, 30.3, 60.7],
                categories: ["AC Empty Weight", "Pilot", "Copilot", "Passengers Row 1", "Passengers Row 2", "Fuel on Board [liters]", "Luggage"],
                units: 'imperial',
                xLabel: 'Momentum [lbs x inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 0
            }
        };

        // Current aircraft selection
        this.currentAircraft = 'TB9';
        this.customModeEnabled = false;

        // Weight and Balance data (will be populated from selected aircraft)
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

        // For Excel and HTML export
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
        this.bindEvents();
        this.loadAircraftData(this.currentAircraft);
        this.initializeWeightBalanceTable();
        this.addWaypointInputs();

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

    // Load aircraft data into current weight balance data
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

        // Initialize weights and moments arrays
        const totalCategories = aircraft.categories.length + 1; // +1 for Total row
        this.weightBalanceData.weights = new Array(totalCategories).fill(0);
        this.weightBalanceData.moments = new Array(totalCategories).fill(0);

        // Set empty weight if defined
        if (aircraft.emptyWeight > 0) {
            this.weightBalanceData.weights[0] = aircraft.emptyWeight;
        }

        // Update UI labels based on units
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

        // Update chart if it exists
        if (this.weightBalanceData.chart) {
            this.weightBalanceData.chart.options.scales.x.title.text = aircraft.xLabel;
            this.weightBalanceData.chart.options.scales.y.title.text = aircraft.yLabel;
            this.weightBalanceData.chart.data.datasets[0].data = this.weightBalanceData.envelope;
            this.weightBalanceData.chart.update();
        }
    }

    bindEvents() {
        // Aircraft selection change
        const aircraftSelect = document.getElementById('aircraftSelect');
        if (aircraftSelect) {
            aircraftSelect.addEventListener('change', (e) => {
                this.loadAircraftData(e.target.value);
                this.initializeWeightBalanceTable();
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
            });
        }

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

        if (enabled) {
            this.showMessage('Custom Mode enabled. You can now edit envelope points and arm values.', 'info');
        }
    }

// ===== AUTOCOMPLETE FUNCTIONS =====
    setupAutocomplete(inputElement) {
        let autocompleteTimeout = null;

        // Create autocomplete container
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

            // Debounce requests
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

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.style.display = 'none';
            }
        });
    }

    async getAutocompleteSuggestions(query) {
        try {
            // Search with Italian priority first
            const italianQuery = `${query}, Italia`;
            const italianResults = await this.searchLocation(italianQuery, true);

            // Then try worldwide if we need more results
            let worldResults = [];
            if (italianResults.length < 3) {
                worldResults = await this.searchLocation(query, false);
            }

            // Combine and limit to 5 suggestions
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
                headers: {
                    'User-Agent': 'VFR Flight Planner App'
                }
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

                // Store coordinates for later use
                inputElement.dataset.lat = suggestion.lat;
                inputElement.dataset.lon = suggestion.lon;
            });

            container.appendChild(div);
        });
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
                <label for="waypoint${i}" class="form-label aviation-label">Waypoint ${i + 1}</label>
                <input type="text" class="form-control aviation-input waypoint-autocomplete" id="waypoint${i}" 
                       placeholder="Nome città (es. Roma, Milano)" autocomplete="off">
            `;
            container.appendChild(div);

            // Setup autocomplete for this input
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
                <label for="alternateWaypoint${i}" class="form-label aviation-label">Alternate Waypoint ${i + 1}</label>
                <input type="text" class="form-control aviation-input waypoint-autocomplete" id="alternateWaypoint${i}" 
                       placeholder="Nome città (es. Napoli, Venezia)" autocomplete="off">
            `;
            container.appendChild(div);

            // Setup autocomplete for this input
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
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            try {
                let coords = { lat: null, lon: null };

                // Check if we have stored coordinates from autocomplete
                const inputElement = document.getElementById(`waypoint${i}`);
                if (inputElement && inputElement.dataset.lat && inputElement.dataset.lon) {
                    coords.lat = parseFloat(inputElement.dataset.lat);
                    coords.lon = parseFloat(inputElement.dataset.lon);
                } else {
                    // Fallback to geocoding
                    const query = `${waypoint}, Italia`;
                    coords = await this.geocodeWithNominatim(query);
                }

                // Get elevation from internet and add base altitude of 1500 feet
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


    async geocodeAlternateWaypoints(waypoints) {
        const geocoded = [];
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i];
            try {
                let coords = { lat: null, lon: null };

                // Check if we have stored coordinates from autocomplete
                const inputElement = document.getElementById(`alternateWaypoint${i}`);
                if (inputElement && inputElement.dataset.lat && inputElement.dataset.lon) {
                    coords.lat = parseFloat(inputElement.dataset.lat);
                    coords.lon = parseFloat(inputElement.dataset.lon);
                } else {
                    // Fallback to geocoding
                    const query = `${waypoint}, Italia`;
                    coords = await this.geocodeWithNominatim(query);
                }

                // Get elevation from internet and add base altitude of 1500 feet
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

        try {
            const geocodedAlternateWaypoints = await this.geocodeAlternateWaypoints(alternateWaypoints);
            this.flightData.alternateWaypoints = geocodedAlternateWaypoints;
            this.flightData.alternateResults = await this.calculateRoute(geocodedAlternateWaypoints);
            this.calculateAlternateFuelData();
            this.updateAlternateTable();
            this.updateAlternateFuelDisplay();
        } catch (error) {
            console.error('Alternate route calculation error:', error);
            throw error; // Re-throw to be caught by parent
        }
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
            this.showMessage('Generazione Excel in corso (PDF temporaneamente disabilitato)...', 'info');

            // Step 1: Genera solo Excel
            await this.exportToExcelWithTemplate();

            // Step 2 e 3: PDF COMPLETAMENTE DISABILITATI
            // this.lastGeneratedHTML = this.generateExcelReplicaHTML();
            // await this.generatePDFFromHTML();

            this.showMessage('Export Excel completato! (PDF temporaneamente disabilitato)', 'success');

        } catch (error) {
            console.error('Export error:', error);
            this.showMessage(`Errore durante l'export: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }
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
            // Store instance for later use
            if (!this.loadingModalInstance) {
                this.loadingModalInstance = new bootstrap.Modal(modal, {
                    backdrop: 'static',
                    keyboard: false
                });
            }
            this.loadingModalInstance.show();
        } else {
            // Try to get instance and hide it
            if (this.loadingModalInstance) {
                this.loadingModalInstance.hide();
            } else {
                const instance = bootstrap.Modal.getInstance(modal);
                if (instance) {
                    instance.hide();
                } else {
                    // Fallback: remove modal backdrop manually
                    modal.classList.remove('show');
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }
            }
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
    // ===== WEIGHT & BALANCE FUNCTIONS (MODIFIED FOR MULTI-AIRCRAFT) =====

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

        // Add Total row
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

        // Destroy existing chart if it exists
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: (${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`;
                            }
                        }
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

            // Calculate for each category
            this.weightBalanceData.categories.forEach((category, index) => {
                const weightInput = document.getElementById(`weight${index}`);
                let armValue = this.weightBalanceData.arms[index];

                // If custom mode, get arm from input
                if (this.customModeEnabled) {
                    const armInput = document.getElementById(`arm${index}`);
                    if (armInput) {
                        armValue = parseFloat(armInput.value) || 0;
                        this.weightBalanceData.arms[index] = armValue;
                    }
                }

                if (!weightInput) return;

                let weight = parseFloat(weightInput.value) || 0;

                // Handle fuel conversion for imperial units
                if (category.includes('Fuel') && aircraft.units === 'imperial') {
                    // Convert liters to lbs using aircraft fuel conversion factor
                    weight = weight * aircraft.fuelConversion;
                }

                let moment = weight * armValue;

                // Add landing gear moment for PA28
                if (index === this.weightBalanceData.categories.length - 1 && aircraft.landingGearMoment > 0) {
                    moment += aircraft.landingGearMoment;
                }

                this.weightBalanceData.weights[index] = weight;
                this.weightBalanceData.moments[index] = moment;

                totalWeight += weight;
                totalMoment += moment;

                // Update moment display
                const momentSpan = document.getElementById(`moment${index}`);
                if (momentSpan) {
                    momentSpan.textContent = moment.toFixed(2);
                }
            });

            // Calculate final arm (CG position)
            const finalArm = totalWeight > 0 ? totalMoment / totalWeight : 0;

            // Update totals
            document.getElementById('totalWeight').textContent = totalWeight.toFixed(2);
            document.getElementById('totalArm').textContent = finalArm.toFixed(3);
            document.getElementById('totalMoment').textContent = totalMoment.toFixed(2);

            // Update chart with aircraft position
            if (this.weightBalanceData.chart) {
                this.weightBalanceData.chart.data.datasets[1].data = [{
                    x: totalMoment,
                    y: totalWeight
                }];
                this.weightBalanceData.chart.update();
            }

            // Check if within limits
            const isWithinLimits = this.isPointInsidePolygon(
                totalMoment, 
                totalWeight, 
                this.weightBalanceData.envelope
            );

            const statusDiv = document.getElementById('wbStatus');
            if (statusDiv) {
                if (isWithinLimits) {
                    statusDiv.className = 'alert alert-success mt-2 inside-range';
                    statusDiv.textContent = 'DENTRO I LIMITI - SAFE FOR FLIGHT';
                } else {
                    statusDiv.className = 'alert alert-danger mt-2 outside-range';
                    statusDiv.textContent = 'FUORI LIMITI - NOT SAFE FOR FLIGHT';
                }
            }

            this.showMessage('Calcolo Weight & Balance completato', 'success');

        } catch (error) {
            console.error('Weight & Balance calculation error:', error);
            this.showMessage(`Errore nel calcolo: ${error.message}`, 'error');
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

        const numPoints = this.weightBalanceData.envelope.length;

        this.weightBalanceData.envelope.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'wb-range-input';
            div.innerHTML = `
                <label>Point ${index + 1}:</label>
                <input type="number" class="form-control" id="envelopeX${index}" 
                    placeholder="X (Moment)" value="${point[0]}" step="0.1">
                <input type="number" class="form-control" id="envelopeY${index}" 
                    placeholder="Y (Weight)" value="${point[1]}" step="0.1">
            `;
            container.appendChild(div);
        });

        // If custom mode, also show arms editor button
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
            div.className = 'wb-range-input';
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

            if (newEnvelope.length < 3) {
                throw new Error('Sono necessari almeno 3 punti per definire l\'envelope');
            }

            this.weightBalanceData.envelope = newEnvelope;

            if (this.weightBalanceData.chart) {
                this.weightBalanceData.chart.data.datasets[0].data = newEnvelope;
                this.weightBalanceData.chart.update();
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('wbRangeModal'));
            if (modal) modal.hide();

            this.showMessage('Envelope aggiornato con successo', 'success');

        } catch (error) {
            console.error('Save WB Range error:', error);
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

            // Refresh the table to show new arm values
            this.initializeWeightBalanceTable();

            const modal = bootstrap.Modal.getInstance(document.getElementById('customArmsModal'));
            if (modal) modal.hide();

            this.showMessage('Valori dei bracci aggiornati con successo', 'success');

        } catch (error) {
            console.error('Save Custom Arms error:', error);
            this.showMessage(`Errore: ${error.message}`, 'error');
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

}

