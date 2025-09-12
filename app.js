// VFR Flight Planning and Weight & Balance Calculator

// Global variables
let waypoints = [];
let alternateRoute = [];
let currentChart = null;

// Configuration constants
const config = {
    defaultFlightSpeed: 90,
    defaultConsumption: 30,
    defaultArmValues: [1.006, 1.155, 2.035, 1.075, 2.6],
    weightBalanceEnvelope: [
        {x: 600, y: 500},
        {x: 1280, y: 1060},
        {x: 1100, y: 1060},
        {x: 910, y: 980},
        {x: 500, y: 550}
    ],
    fuelDensity: 0.72
};

// Tab Navigation Functions
function switchTab(tabId, tabButton) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab content
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Add active class to clicked button
    tabButton.classList.add('active');

    // Initialize chart when Weight & Balance tab is opened
    if (tabId === 'weight-balance' && !currentChart) {
        setTimeout(() => {
            initializeWeightBalanceChart();
        }, 100);
    }
}

// Flight Planning Functions
function generateWaypoints() {
    const numWaypointsInput = document.getElementById('num-waypoints');
    const numWaypoints = parseInt(numWaypointsInput.value);
    const container = document.getElementById('waypoints-container');
    const section = document.getElementById('waypoints-section');

    if (isNaN(numWaypoints) || numWaypoints < 2 || numWaypoints > 20) {
        showError('Il numero di waypoints deve essere tra 2 e 20');
        return;
    }

    container.innerHTML = '';

    for (let i = 0; i < numWaypoints; i++) {
        const waypointDiv = document.createElement('div');
        waypointDiv.className = 'waypoint-input';
        waypointDiv.innerHTML = `
            <label class="form-label">Waypoint ${i + 1}</label>
            <input type="text" class="form-control waypoint-name" 
                   placeholder="Nome città/aeroporto" required>
        `;
        container.appendChild(waypointDiv);
    }

    section.style.display = 'block';
}

function toggleAlternate() {
    const includeAlternate = document.getElementById('include-alternate');
    const alternateSection = document.getElementById('alternate-section');
    
    if (alternateSection) {
        alternateSection.style.display = includeAlternate.checked ? 'block' : 'none';
    }
}

async function calculateRoute() {
    showLoading(true);
    
    try {
        const waypointInputs = document.querySelectorAll('.waypoint-name');
        const waypointNames = Array.from(waypointInputs)
            .map(input => input.value.trim())
            .filter(name => name !== '');

        if (waypointNames.length < 2) {
            throw new Error('Inserire almeno 2 waypoints');
        }

        // Get coordinates for all waypoints
        const coordinates = await getCoordinatesForWaypoints(waypointNames);
        waypoints = coordinates.map((coord, index) => ({
            name: waypointNames[index],
            lat: coord.lat,
            lon: coord.lon
        }));

        // Calculate route data
        const routeData = calculateRouteSegments(waypoints);
        displayFlightResults(routeData);

        // Handle alternate if enabled
        if (document.getElementById('include-alternate').checked) {
            await calculateAlternateRoute();
        }

    } catch (error) {
        showError(`Errore nel calcolo della rotta: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function getCoordinatesForWaypoints(waypointNames) {
    const coordinates = [];
    
    for (const name of waypointNames) {
        try {
            const coord = await geocodeLocation(name);
            coordinates.push(coord);
        } catch (error) {
            throw new Error(`Impossibile geocodificare: ${name}`);
        }
    }
    
    return coordinates;
}

async function geocodeLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            throw new Error(`Nessun risultato trovato per: ${location}`);
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error(`Errore geocoding per ${location}`);
    }
}

function calculateRouteSegments(waypoints) {
    const cruiseSpeedInput = document.getElementById('cruise-speed');
    const fuelConsumptionInput = document.getElementById('fuel-consumption');
    
    const cruiseSpeed = parseFloat(cruiseSpeedInput.value) || config.defaultFlightSpeed;
    const fuelConsumption = parseFloat(fuelConsumptionInput.value) || config.defaultConsumption;
    
    const segments = [];
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];
        
        const distance = calculateGreatCircleDistance(from.lat, from.lon, to.lat, to.lon);
        const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);
        const flightTime = (distance / cruiseSpeed) * 60; // minutes
        
        segments.push({
            from: from.name,
            to: to.name,
            distance: distance,
            bearing: Math.round(bearing),
            flightTime: Math.round(flightTime),
            altitude: 3000 + (i * 500), // Sample altitude progression
            radial: Math.round((bearing + 180) % 360)
        });

        totalDistance += distance;
        totalTime += flightTime;
    }

    const totalFuel = (totalTime / 60) * fuelConsumption;

    return {
        segments: segments,
        totals: {
            distance: totalDistance,
            time: totalTime,
            fuel: totalFuel
        }
    };
}

function calculateGreatCircleDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRadians(lon2 - lon1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

function displayFlightResults(routeData) {
    const tbody = document.getElementById('flight-results-body');
    const resultsSection = document.getElementById('flight-results');
    
    if (!tbody || !resultsSection) return;
    
    tbody.innerHTML = '';
    
    routeData.segments.forEach((segment, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${segment.from}</td>
            <td>${segment.bearing}°</td>
            <td>${segment.altitude}</td>
            <td>${segment.distance.toFixed(1)}</td>
            <td>${segment.radial}°</td>
            <td>${segment.flightTime}</td>
        `;
    });

    // Add destination row
    if (routeData.segments.length > 0) {
        const lastSegment = routeData.segments[routeData.segments.length - 1];
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${lastSegment.to}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        `;
    }

    // Update totals
    const totalDistanceEl = document.getElementById('total-distance');
    const totalTimeEl = document.getElementById('total-time');
    const fuelRequiredEl = document.getElementById('fuel-required');
    
    if (totalDistanceEl) totalDistanceEl.textContent = `${routeData.totals.distance.toFixed(1)} NM`;
    if (totalTimeEl) totalTimeEl.textContent = `${Math.round(routeData.totals.time)} min`;
    if (fuelRequiredEl) fuelRequiredEl.textContent = `${routeData.totals.fuel.toFixed(1)} L`;

    resultsSection.style.display = 'block';
}

async function calculateAlternateRoute() {
    const departure = document.getElementById('alternate-departure').value.trim();
    const destination = document.getElementById('alternate-destination').value.trim();

    if (!departure || !destination) {
        return;
    }

    try {
        const depCoord = await geocodeLocation(departure);
        const destCoord = await geocodeLocation(destination);
        
        const alternateWaypoints = [
            { name: departure, lat: depCoord.lat, lon: depCoord.lon },
            { name: destination, lat: destCoord.lat, lon: destCoord.lon }
        ];

        const alternateData = calculateRouteSegments(alternateWaypoints);
        displayAlternateResults(alternateData);
        
    } catch (error) {
        showError(`Errore calcolo rotta alternato: ${error.message}`);
    }
}

function displayAlternateResults(routeData) {
    const tbody = document.getElementById('alternate-results-body');
    const section = document.getElementById('alternate-results');
    
    if (!tbody || !section) return;
    
    tbody.innerHTML = '';
    
    routeData.segments.forEach(segment => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${segment.from}</td>
            <td>${segment.bearing}°</td>
            <td>${segment.altitude}</td>
            <td>${segment.distance.toFixed(1)}</td>
            <td>${segment.radial}°</td>
            <td>${segment.flightTime}</td>
        `;
    });

    // Add destination
    if (routeData.segments.length > 0) {
        const lastSegment = routeData.segments[routeData.segments.length - 1];
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${lastSegment.to}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        `;
    }

    section.style.display = 'block';
}

// Weight & Balance Functions
function updateWBCalculation() {
    let totalWeight = 0;
    let totalMoment = 0;

    // Calculate for weight inputs
    document.querySelectorAll('.wb-weight').forEach((input, index) => {
        const weight = parseFloat(input.value) || 0;
        const arm = parseFloat(input.dataset.arm) || config.defaultArmValues[index] || 1.0;
        const moment = weight * arm;
        
        // Update moment display
        const momentCell = input.closest('tr').querySelector('.wb-moment');
        if (momentCell) {
            momentCell.textContent = moment.toFixed(1);
        }
        
        totalWeight += weight;
        totalMoment += moment;
    });

    // Handle fuel separately (convert liters to kg)
    const fuelInput = document.querySelector('.wb-fuel');
    if (fuelInput) {
        const fuelLiters = parseFloat(fuelInput.value) || 0;
        const fuelWeight = fuelLiters * config.fuelDensity;
        const fuelArm = 1.075;
        const fuelMoment = fuelWeight * fuelArm;
        
        // Update fuel moment display
        const fuelMomentCell = fuelInput.closest('tr').querySelector('.wb-moment');
        if (fuelMomentCell) {
            fuelMomentCell.textContent = fuelMoment.toFixed(1);
        }
        
        totalWeight += fuelWeight;
        totalMoment += fuelMoment;
    }

    // Calculate CG
    const totalArm = totalWeight > 0 ? totalMoment / totalWeight : 0;

    // Update totals
    const totalWeightEl = document.getElementById('total-weight');
    const totalArmEl = document.getElementById('total-arm');
    const totalMomentEl = document.getElementById('total-moment');
    
    if (totalWeightEl) totalWeightEl.textContent = totalWeight.toFixed(1);
    if (totalArmEl) totalArmEl.textContent = totalArm.toFixed(3);
    if (totalMomentEl) totalMomentEl.textContent = totalMoment.toFixed(1);

    return { weight: totalWeight, arm: totalArm, moment: totalMoment };
}

function calculateWB() {
    const totals = updateWBCalculation();
    
    if (totals.weight === 0) {
        showError('Inserire almeno un peso per calcolare il Weight & Balance');
        return;
    }

    // Check if point is within envelope
    const isWithinEnvelope = isPointInEnvelope(totals.arm * 1000, totals.weight); // Convert arm to mm
    
    // Update status
    const statusDiv = document.getElementById('wb-status');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        
        if (isWithinEnvelope) {
            statusDiv.className = 'wb-status safe';
            statusDiv.textContent = 'WITHIN W&B RANGE - Safe to fly';
        } else {
            statusDiv.className = 'wb-status unsafe';
            statusDiv.textContent = 'OUTSIDE W&B RANGE - Not safe to fly';
        }
    }

    // Update chart
    updateWeightBalanceChart(totals.arm * 1000, totals.weight);
}

function resetWB() {
    // Clear all inputs
    document.querySelectorAll('.wb-weight, .wb-fuel').forEach(input => {
        input.value = '';
    });

    // Clear moments
    document.querySelectorAll('.wb-moment').forEach(cell => {
        cell.textContent = '0.0';
    });

    // Reset totals
    const totalWeightEl = document.getElementById('total-weight');
    const totalArmEl = document.getElementById('total-arm');
    const totalMomentEl = document.getElementById('total-moment');
    
    if (totalWeightEl) totalWeightEl.textContent = '0.0';
    if (totalArmEl) totalArmEl.textContent = '0.0';
    if (totalMomentEl) totalMomentEl.textContent = '0.0';

    // Hide status
    const statusDiv = document.getElementById('wb-status');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }

    // Reset chart
    updateWeightBalanceChart(0, 0);
}

function initializeWeightBalanceChart() {
    const chartCanvas = document.getElementById('wb-chart');
    if (!chartCanvas || currentChart) {
        return;
    }
    
    const ctx = chartCanvas.getContext('2d');
    
    const envelopeData = config.weightBalanceEnvelope.map(point => ({
        x: point.x,
        y: point.y
    }));

    currentChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'W&B Envelope',
                    data: envelopeData,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    borderWidth: 2,
                    showLine: true,
                    pointRadius: 4,
                    fill: true
                },
                {
                    label: 'Current W&B',
                    data: [],
                    backgroundColor: '#DB4545',
                    borderColor: '#DB4545',
                    pointRadius: 8,
                    pointHoverRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Weight & Balance Envelope'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Center of Gravity (mm)'
                    },
                    min: 400,
                    max: 1400
                },
                y: {
                    title: {
                        display: true,
                        text: 'Weight (kg)'
                    },
                    min: 400,
                    max: 1200
                }
            }
        }
    });
}

function updateWeightBalanceChart(armMm, weight) {
    if (currentChart && weight > 0) {
        currentChart.data.datasets[1].data = [{x: armMm, y: weight}];
    } else if (currentChart) {
        currentChart.data.datasets[1].data = [];
    }
    
    if (currentChart) {
        currentChart.update();
    }
}

function isPointInEnvelope(x, y) {
    const polygon = config.weightBalanceEnvelope;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

// Utility Functions
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('VFR Flight Planner loaded successfully');
});