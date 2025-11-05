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

        // Aircraft configurations
        this.aircraftConfigs = {
            'TB9': {
                name: 'TB9 (Default)',
                emptyWeight: 617.97,
                unit: 'kg',
                momentUnit: 'kg·m',
                arms: [1.006, 1.155, 2.035, 1.075, 2.6],
                armUnit: 'm',
                envelope: [[600, 500], [1280, 1060], [1100, 1060], [910, 980], [500, 550]],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                fuelConversion: 0.72,
                landingGearMoment: 0,
                momentDivisor: 1
            },
            'TB10': {
                name: 'TB10',
                emptyWeight: 727.37,
                unit: 'kg',
                momentUnit: 'kg·m',
                arms: [1, 1.155, 2.035, 1.075, 2.6],
                armUnit: 'm',
                envelope: [[600,500],[920,980],[1250,1155],[1380,1555],[500,550]],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                fuelConversion: 0.72,
                landingGearMoment: 0,
                momentDivisor: 1
            },
            'PA28': {
                name: 'PA28',
                emptyWeight: 1824.44,
                unit: 'lbs',
                momentUnit: 'lbs·in',
                arms: [89.48, 80.5, 118.1, 95, 142.9],
                armUnit: 'in',
                envelope: [[85.5,1400],[85.5,2250],[90,2780],[93,2780],[93,1400]],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                fuelConversion: 1.59,
                landingGearMoment: 819,
                momentDivisor: 1
            },
            'P68B': {
                name: 'P68B',
                emptyWeight: 2957.57,
                unit: 'lbs',
                momentUnit: 'lbs·in',
                arms: [16.492, -37.4, -5.7, 34.2, 30.3, 60.7],
                armUnit: 'in',
                envelope: [[10.2,2650],[10.2,3550],[12.8,4350],[20.6,4350],[20.6,2650]],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Passengers Row 1", "Passengers Row 2", "Fuel on Board [AvGas liters]", "Baggage"],
                fuelConversion: 1.59,
                landingGearMoment: 0,
                momentDivisor: 1
            }
        };

        this.currentAircraft = 'TB9';

        this.weightBalanceData = {
            envelope: this.aircraftConfigs['TB9'].envelope,
            arms: this.aircraftConfigs['TB9'].arms,
            categories: [...this.aircraftConfigs['TB9'].categories, "Total"],
            weights: new Array(this.aircraftConfigs['TB9'].categories.length + 1).fill(0),
            moments: new Array(this.aircraftConfigs['TB9'].categories.length + 1).fill(0),
            chart: null
        };

        // Set initial empty weight
        this.weightBalanceData.weights[0] = this.aircraftConfigs['TB9'].emptyWeight;
        this.weightBalanceData.moments[0] = (this.aircraftConfigs['TB9'].emptyWeight * this.aircraftConfigs['TB9'].arms[0]) / this.aircraftConfigs['TB9'].momentDivisor;

        this.customMode = false;
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



    // ===== WEIGHT AND BALANCE FUNCTIONS =====

    changeAircraft(aircraftType) {
        if (!this.aircraftConfigs[aircraftType]) {
            console.error('Aircraft type not found:', aircraftType);
            return;
        }

        this.currentAircraft = aircraftType;
        const config = this.aircraftConfigs[aircraftType];

        // Update weight balance data structure
        this.weightBalanceData.envelope = config.envelope;
        this.weightBalanceData.arms = config.arms;
        this.weightBalanceData.categories = [...config.categories, "Total"];

        // Reset arrays
        const numCategories = config.categories.length + 1;
        this.weightBalanceData.weights = new Array(numCategories).fill(0);
        this.weightBalanceData.moments = new Array(numCategories).fill(0);

        // Set empty weight
        this.weightBalanceData.weights[0] = config.emptyWeight;
        this.weightBalanceData.moments[0] = (config.emptyWeight * config.arms[0] + config.landingGearMoment) / config.momentDivisor;

        // Calculate initial totals
        this.calculateWeightBalanceTotals();

        // Update UI
        this.updateWeightBalanceHeaders();
        this.updateWeightBalanceTable();

        // Update chart - IMPORTANTE: forza il refresh del grafico
        if (this.weightBalanceData.chart) {
            this.updateWeightBalanceChart();
        }

        console.log(`Aircraft changed to: ${config.name}`);
    }

    updateWeightBalanceHeaders() {
        const config = this.aircraftConfigs[this.currentAircraft];

        const weightHeader = document.getElementById('wbWeightHeader');
        const armHeader = document.getElementById('wbArmHeader');
        const momentHeader = document.getElementById('wbMomentHeader');

        if (weightHeader) weightHeader.textContent = `Weight[${config.unit}]`;
        if (armHeader) armHeader.textContent = `Arm[${config.armUnit}]`;
        if (momentHeader) momentHeader.textContent = `Moment[${config.momentUnit}]`;
    }

    updateWeightBalanceTable() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;

        const config = this.aircraftConfigs[this.currentAircraft];
        tbody.innerHTML = '';

        this.weightBalanceData.categories.forEach((category, index) => {
            const row = document.createElement('tr');
            const isTotal = index === this.weightBalanceData.categories.length - 1;
            const isEmptyWeight = index === 0;

            if (isTotal) row.className = 'total-row';

            const weight = this.weightBalanceData.weights[index] || 0;
            const moment = this.weightBalanceData.moments[index] || 0;
            const arm = index < config.arms.length ? config.arms[index] : 0;

            row.innerHTML = `
                <td class="category-name">${category}</td>
                <td>
                    <input type="number" 
                           class="form-control weight-input aviation-input" 
                           data-index="${index}"
                           value="${weight.toFixed(2)}"
                           ${isTotal ? 'readonly' : ''}
                           step="0.1"
                           min="0"
                           placeholder="0.00">
                </td>
                <td class="arm-value">${ this.customMode ? `<input type=\"number\" class=\"form-control aviation-input\" data-arm-index=\"${index}\" value=\"${arm.toFixed(3)}\" step=\"0.001\" />` : arm.toFixed(3) }</td>
                <td class="moment-value">${moment.toFixed(2)}</td>
            `;

            tbody.appendChild(row);

            // Add event listener for editable inputs
            if (!isTotal && !isEmptyWeight) {
                const input = row.querySelector('.weight-input');
                if (input) {
                    input.addEventListener('input', (e) => {
                        const value = parseFloat(e.target.value) || 0;
                        this.updateWeightBalanceCalculation(index, value);
                    });

                    input.addEventListener('change', (e) => {
                        const value = parseFloat(e.target.value) || 0;
                        e.target.value = value.toFixed(2);
                    });
                }
            }
        });

        // Update limits after table is created
        this.updateWeightBalanceLimits();
    }

    updateWeightBalanceCalculation(index, weight) {
        const config = this.aircraftConfigs[this.currentAircraft];

        // Update weight
        this.weightBalanceData.weights[index] = weight;

        // Calculate moment
        if (index < config.arms.length) {
            const isFuel = config.categories[index] && config.categories[index].includes('Fuel');

            if (isFuel) {
                // Convert fuel to weight
                const fuelWeight = weight * config.fuelConversion;
                this.weightBalanceData.moments[index] = (fuelWeight * config.arms[index]) / config.momentDivisor;
            } else {
                this.weightBalanceData.moments[index] = (weight * config.arms[index]) / config.momentDivisor;
            }
        }

        // Recalculate totals
        this.calculateWeightBalanceTotals();

        // Update display
        this.updateWeightBalanceDisplay();
        this.updateWeightBalanceChart();
    }

    calculateWeightBalanceTotals() {
        const config = this.aircraftConfigs[this.currentAircraft];
        const totalIndex = this.weightBalanceData.categories.length - 1;

        let totalWeight = 0;
        let totalMoment = 0;

        for (let i = 0; i < totalIndex; i++) {
            if (i < config.categories.length) {
                const isFuel = config.categories[i].includes('Fuel');
                if (isFuel) {
                    totalWeight += (this.weightBalanceData.weights[i] || 0) * config.fuelConversion;
                } else {
                    totalWeight += this.weightBalanceData.weights[i] || 0;
                }
            }
            totalMoment += this.weightBalanceData.moments[i] || 0;
        }

        this.weightBalanceData.weights[totalIndex] = totalWeight;
        this.weightBalanceData.moments[totalIndex] = totalMoment;
    }

    updateWeightBalanceDisplay() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const momentCell = row.querySelector('.moment-value');
            if (momentCell) {
                momentCell.textContent = (this.weightBalanceData.moments[index] || 0).toFixed(2);
            }

            const weightInput = row.querySelector('.weight-input');
            if (weightInput && weightInput.hasAttribute('readonly')) {
                weightInput.value = (this.weightBalanceData.weights[index] || 0).toFixed(2);
            }
        });

        this.updateWeightBalanceLimits();
    }

    updateWeightBalanceLimits() {
        const config = this.aircraftConfigs[this.currentAircraft];
        const totalIndex = this.weightBalanceData.categories.length - 1;
        const totalWeight = this.weightBalanceData.weights[totalIndex] || 0;
        const totalMoment = this.weightBalanceData.moments[totalIndex] || 0;

        // Check envelope
        const isWithinEnvelope = totalWeight > 0 ? this.isPointInPolygon(totalMoment, totalWeight, config.envelope) : true;

        // Update status
        const statusElement = document.getElementById('wbStatus');
        if (statusElement) {
            if (totalWeight === 0) {
                statusElement.className = 'wb-status';
                statusElement.textContent = 'Enter weights';
            } else if (isWithinEnvelope) {
                statusElement.className = 'wb-status wb-status-ok';
                statusElement.textContent = '✓ Within Limits';
            } else {
                statusElement.className = 'wb-status wb-status-warning';
                statusElement.textContent = '⚠ Outside Limits';
            }
        }

        // Update CG
        const cgElement = document.getElementById('cgPosition');
        if (cgElement && totalWeight > 0) {
            const cg = (totalMoment * config.momentDivisor) / totalWeight;
            cgElement.textContent = `CG: ${cg.toFixed(2)} ${config.armUnit}`;
        } else if (cgElement) {
            cgElement.textContent = '';
        }
    }

    isPointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];

            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
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
    

        // Aircraft Selection Event
        const aircraftSelect = document.getElementById('aircraftSelect');
        if (aircraftSelect) {
            aircraftSelect.addEventListener('change', (e) => {
                console.log('Aircraft changed to:', e.target.value);
                this.changeAircraft(e.target.value);
            });

        // Custom Mode toggle - allows editing arms and envelope points
        const customCheckbox = document.getElementById('customMode');
        if (customCheckbox) {
            customCheckbox.addEventListener('change', (ev) => {
                this.customMode = ev.target.checked;
                // When custom mode toggled, re-render table to allow arm editing
                this.updateWeightBalanceTable();
            });
        }

        // Listen for arm edits (delegated)
        document.addEventListener('input', (ev) => {
            if (!this.customMode) return;
            const target = ev.target;
            if (target && target.dataset && target.dataset.armIndex) {
                const idx = parseInt(target.dataset.armIndex);
                const val = parseFloat(target.value) || 0;
                // update current aircraft arms
                this.aircraftConfigs[this.currentAircraft].arms[idx] = val;
                // recalc moments
                this.recalculateMomentsFromWeights();
                this.updateWeightBalanceDisplay();
                this.updateWeightBalanceChart();
            }
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
        this.updateWeightBalanceHeaders();
        this.updateWeightBalanceTable();
    }

        initializeWeightBalanceChart() {
        const canvas = document.getElementById('wbChart');
        if (!canvas) return;

        const config = this.aircraftConfigs[this.currentAircraft];

        const ctx = canvas.getContext('2d');
        this.weightBalanceData.chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'W&B Envelope',
                    data: config.envelope,
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
                            text: `Moment [${config.momentUnit}]`
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: `Weight [${config.unit}]`
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `W: ${context.parsed.y.toFixed(1)}, M: ${context.parsed.x.toFixed(1)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateWeightBalanceChart() {
        if (!this.weightBalanceData.chart) {
            this.initializeWeightBalanceChart();
            return;
        }

        const config = this.aircraftConfigs[this.currentAircraft];
        const totalIndex = this.weightBalanceData.categories.length - 1;

        // Update envelope data - CHIAVE per il refresh del grafico
        this.weightBalanceData.chart.data.datasets[0].data = [...config.envelope];

        // Update aircraft position
        const totalWeight = this.weightBalanceData.weights[totalIndex] || 0;
        const totalMoment = this.weightBalanceData.moments[totalIndex] || 0;

        if (totalWeight > 0) {
            this.weightBalanceData.chart.data.datasets[1].data = [{
                x: totalMoment,
                y: totalWeight
            }];
        } else {
            this.weightBalanceData.chart.data.datasets[1].data = [];
        }

        // Update axis labels
        this.weightBalanceData.chart.options.scales.x.title.text = `Moment [${config.momentUnit}]`;
        this.weightBalanceData.chart.options.scales.y.title.text = `Weight [${config.unit}]`;

        // IMPORTANTE: forza l'update del grafico
        this.weightBalanceData.chart.update('active');
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
