import { WeatherService } from '../services/WeatherService.js';
import { AirportService } from '../services/AirportService.js';
import { MetarDisplay } from './MetarDisplay.js';
import { TafDisplay } from './TafDisplay.js';
import { NotamDisplay } from './NotamDisplay.js';

export class WeatherManager {
    constructor() {
        this.searchInput = document.getElementById('weatherIcao');
        this.searchButton = document.getElementById('searchWeather');
        this.statusDiv = document.getElementById('weatherStatus');

        // Cards
        this.metarDisplayContainer = document.getElementById('metarDisplayContainer');
        this.tafDisplayContainer = document.getElementById('tafDisplayContainer');
        this.notamDisplayContainer = document.getElementById('notamDisplayContainer');
        this.airportInfoContainer = document.getElementById('airportInfoContainer');

        // Enhanced Displays
        this.metarDisplay = new MetarDisplay('metarDisplayContainer');
        this.tafDisplay = new TafDisplay('tafDisplayContainer');
        this.notamDisplay = new NotamDisplay('notamDisplayContainer');
        this.currentAirportInfo = null;

        // Map
        this.map = null;
        this.mapLayer = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.searchButton) {
            this.searchButton.addEventListener('click', () => {
                const icao = this.searchInput.value.trim();
                if (icao) this.fetchData(icao);
            });
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const icao = this.searchInput.value.trim();
                    if (icao) this.fetchData(icao);
                }
            });
        }
    }

    async fetchData(icao) {
        this.showLoading(true);
        this.clearDisplay();
        this.showStatus('Loading airport database... (this may take a moment)', 'info');

        try {
            // Fetch Weather
            const [metar, taf] = await Promise.all([
                WeatherService.getMetar(icao),
                WeatherService.getTaf(icao)
            ]);

            // Fetch Airport Info
            const airportInfo = await AirportService.getAirportInfo(icao);

            if (!metar && !taf && !airportInfo) {
                this.showStatus('No data found for this airport.', 'warning');
                return;
            }

            // Store airport info for use in METAR display
            this.currentAirportInfo = airportInfo;

            if (metar) this.displayMetar(metar, airportInfo);
            if (taf) this.displayTaf(taf);

            // Fetch and display NOTAMs
            try {
                const notams = await WeatherService.getNotams(icao);
                this.displayNotams(notams, icao);
            } catch (notamError) {
                console.warn('NOTAMs not available:', notamError);
            }

            if (airportInfo) {
                this.displayAirportInfo(airportInfo);
                this.showStatus('Dati caricati con successo.', 'success');
            } else {
                this.showStatus('Dati meteo caricati. Info aeroporto non trovate.', 'warning');
            }

        } catch (error) {
            console.error('Error fetching weather data:', error);
            this.showStatus('Error fetching data. Please check your connection.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayMetar(data, airportInfo) {
        const parsed = WeatherService.parseMetar(data);
        if (!parsed) return;

        // Set runways for wind analysis
        if (airportInfo?.runways) {
            this.metarDisplay.setRunways(airportInfo.runways);
        }

        // Show container and render enhanced display
        this.metarDisplayContainer.style.display = 'block';
        this.metarDisplay.render(parsed, airportInfo);
    }

    displayTaf(data) {
        this.tafDisplayContainer.style.display = 'block';
        this.tafDisplay.render(data);
    }

    displayNotams(notams, icao) {
        this.notamDisplayContainer.style.display = 'block';
        this.notamDisplay.render(notams, icao);
    }

    displayAirportInfo(info) {
        this.airportInfoContainer.style.display = 'block';

        // Header
        document.getElementById('airportNameHeader').textContent = `${info.name} (${info.ident})`;

        // Details Table (removed Website row)
        const detailsBody = document.getElementById('airportDetailsBody');
        detailsBody.innerHTML = `
            <tr><td><strong>ICAO</strong></td><td>${info.ident}</td></tr>
            <tr><td><strong>IATA</strong></td><td>${info.iata_code || '-'}</td></tr>
            <tr><td><strong>Type</strong></td><td>${info.type.replace('_', ' ')}</td></tr>
            <tr><td><strong>Region</strong></td><td>${info.iso_region}</td></tr>
            <tr><td><strong>Municipality</strong></td><td>${info.municipality}</td></tr>
            <tr><td><strong>Elevation</strong></td><td>${info.elevation_ft} ft</td></tr>
            <tr><td><strong>Coordinates</strong></td><td>${Number(info.latitude_deg).toFixed(4)}, ${Number(info.longitude_deg).toFixed(4)}</td></tr>
        `;

        // Map
        this.initMap(parseFloat(info.latitude_deg), parseFloat(info.longitude_deg));

        // Runways
        const runwayBody = document.getElementById('runwayTableBody');
        if (info.runways && info.runways.length > 0) {
            runwayBody.innerHTML = info.runways.map(r => {
                // Convert dimensions
                const lengthM = Math.round(r.length_ft * 0.3048);
                const widthM = Math.round(r.width_ft * 0.3048);

                return `
                <tr>
                    <td><strong>${r.le_ident}/${r.he_ident}</strong></td>
                    <td>${r.length_ft}x${r.width_ft} ft <br> <span class="text-muted small">(${lengthM}x${widthM} m)</span></td>
                    <td>${r.surface}</td>
                    <td>${r.lighted === '1' ? 'Yes' : 'No'}</td>
                </tr>
            `}).join('');
        } else {
            runwayBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No runway data available</td></tr>';
        }

        // Frequencies
        const freqBody = document.getElementById('frequencyTableBody');
        if (info.frequencies && info.frequencies.length > 0) {
            // Sort: ATIS first, then TWR, then others
            const sortedFreqs = [...info.frequencies].sort((a, b) => {
                const typeA = a.type.toUpperCase();
                const typeB = b.type.toUpperCase();
                if (typeA.includes('ATIS') && !typeB.includes('ATIS')) return -1;
                if (!typeA.includes('ATIS') && typeB.includes('ATIS')) return 1;
                if (typeA.includes('TWR') && !typeB.includes('TWR')) return -1;
                if (!typeA.includes('TWR') && typeB.includes('TWR')) return 1;
                return 0;
            });

            freqBody.innerHTML = sortedFreqs.map(f => `
                <tr>
                    <td><span class="badge ${f.type.toUpperCase().includes('ATIS') ? 'bg-warning text-dark' : 'bg-secondary'}">${f.type}</span></td>
                    <td class="font-monospace fw-bold">${f.frequency_mhz}</td>
                    <td>${f.description || '-'}</td>
                </tr>
            `).join('');
        } else {
            freqBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No frequency data available</td></tr>';
        }

        // Nearby Airports
        const nearbyList = document.getElementById('nearbyAirportsList');
        if (info.nearby && info.nearby.length > 0) {
            nearbyList.innerHTML = info.nearby.map(a => `
                <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="document.getElementById('weatherIcao').value='${a.ident}'; document.getElementById('searchWeather').click();">
                    <div>
                        <strong>${a.ident}</strong> - ${a.name}
                        <div class="small text-muted">${a.municipality || ''}</div>
                    </div>
                    <span class="badge bg-primary rounded-pill">${Math.round(a.distance)} km</span>
                </button>
            `).join('');
        } else {
            nearbyList.innerHTML = '<div class="p-3 text-center text-muted">No nearby airports found</div>';
        }
    }

    initMap(lat, lon) {
        const mapContainer = document.getElementById('airportMap');

        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet (L) is not defined. Map cannot be initialized.');
            return;
        }

        // Check if container exists
        if (!mapContainer) {
            console.error('Map container (airportMap) not found.');
            return;
        }

        console.log('Initializing map at:', lat, lon);

        // Use requestAnimationFrame + setTimeout for better timing
        requestAnimationFrame(() => {
            setTimeout(() => {
                try {
                    // If map already exists, remove it first
                    if (this.map) {
                        console.log('Removing existing map...');
                        this.map.remove();
                        this.map = null;
                        this.mapLayer = null;
                    }

                    console.log('Creating new map...');

                    // Create new map
                    this.map = L.map('airportMap', {
                        center: [lat, lon],
                        zoom: 13
                    });

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(this.map);

                    // Add marker
                    this.mapLayer = L.marker([lat, lon]).addTo(this.map);

                    console.log('Map created successfully');

                    // Force size recalculation after a short delay
                    setTimeout(() => {
                        if (this.map) {
                            this.map.invalidateSize();
                            console.log('Map invalidateSize called');
                        }
                    }, 200);

                } catch (error) {
                    console.error('Error initializing map:', error);
                }
            }, 300);
        });
    }

    getCategoryColor(category) {
        switch (category) {
            case 'VFR': return 'text-success';
            case 'MVFR': return 'text-primary';
            case 'IFR': return 'text-danger';
            case 'LIFR': return 'text-danger';
            default: return 'text-muted';
        }
    }

    showLoading(isLoading) {
        if (this.searchButton) {
            this.searchButton.disabled = isLoading;
            this.searchButton.innerHTML = isLoading ?
                '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' :
                'Search';
        }
    }

    showStatus(message, type) {
        this.statusDiv.innerHTML = `<div class="alert alert-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'success'} py-2 mb-0">${message}</div>`;
    }

    clearDisplay() {
        this.metarDisplayContainer.style.display = 'none';
        this.tafDisplayContainer.style.display = 'none';
        this.notamDisplayContainer.style.display = 'none';
        this.airportInfoContainer.style.display = 'none';
        this.statusDiv.innerHTML = '';
    }
}
