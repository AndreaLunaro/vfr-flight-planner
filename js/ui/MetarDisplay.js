/**
 * MetarDisplay - Simplified graphical METAR display component
 * Clean card-based layout consistent with app styling
 */
export class MetarDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.runways = [];
    }

    setRunways(runways) {
        this.runways = runways || [];
    }

    /**
     * Get the best runway for current wind
     * Correctly parses runway identifiers like "12", "12L", "30R", etc.
     */
    getBestRunway(metar) {
        if (!this.runways || this.runways.length === 0) return null;

        const windDir = metar.wind.direction || 0;
        const windSpeed = metar.wind.speed || 0;

        // Handle variable wind - no specific runway preference
        if (metar.wind.direction === 'Variable' || windSpeed < 3) {
            return null;
        }

        let bestRunway = null;
        let bestHeadwind = -Infinity;

        this.runways.forEach(rw => {
            // Extract numeric heading from runway ID (handles "12", "12L", "12R", "12C", etc.)
            const heading1 = this.parseRunwayHeading(rw.le_ident);
            const heading2 = this.parseRunwayHeading(rw.he_ident);

            if (heading1 === null || heading2 === null) return; // Skip invalid runways

            const calc1 = this.calculateRunwayWind(windDir, windSpeed, heading1);
            const calc2 = this.calculateRunwayWind(windDir, windSpeed, heading2);

            if (calc1.headwind > calc2.headwind && calc1.headwind > bestHeadwind) {
                bestHeadwind = calc1.headwind;
                bestRunway = { id: rw.le_ident, headwind: calc1.headwind, crosswind: calc1.crosswind, heading: heading1 };
            } else if (calc2.headwind > bestHeadwind) {
                bestHeadwind = calc2.headwind;
                bestRunway = { id: rw.he_ident, headwind: calc2.headwind, crosswind: calc2.crosswind, heading: heading2 };
            }
        });

        return bestRunway;
    }

    /**
     * Parse runway heading from identifier
     * Handles: "07", "25", "12L", "30R", "09C", etc.
     * Returns magnetic heading in degrees or null if invalid
     */
    parseRunwayHeading(rwIdent) {
        if (!rwIdent) return null;
        // Extract leading digits (1-2 digits)
        const match = rwIdent.toString().match(/^(\d{1,2})/);
        if (!match) return null;
        const num = parseInt(match[1], 10);
        // Runway numbers are 01-36
        if (num < 1 || num > 36) return null;
        return num * 10;
    }

    /**
     * Render the complete METAR display
     */
    render(metar, airportInfo) {
        if (!this.container || !metar) return;

        const lat = airportInfo?.latitude_deg || 0;
        const lon = airportInfo?.longitude_deg || 0;
        const sunTimes = this.calculateSunTimes(lat, lon);
        const humidity = this.calculateHumidity(metar.temperature, metar.dewpoint);
        const windChill = this.calculateWindChill(metar.temperature, metar.wind.speed);
        const bestRunway = this.getBestRunway(metar);

        this.container.innerHTML = `
            <div class="card aviation-card mb-4">
                <!-- Header -->
                <div class="card-header aviation-card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">METAR ${metar.icao || ''} - ${airportInfo?.name || ''}</h5>
                    <span class="badge bg-light text-dark">${this.formatTime(metar.time)}</span>
                </div>
                
                <div class="card-body">
                    <!-- Info Cards Row -->
                    ${this.renderInfoCards(metar, bestRunway)}

                    <!-- Two Column Layout -->
                    <div class="row">
                        <!-- Left Column: Wind Analysis -->
                        <div class="col-md-6 mb-3">
                            ${this.renderWindSection(metar, bestRunway)}
                            ${this.renderRunwayAnalysis(metar)}
                        </div>

                        <!-- Right Column: Temperature & Daylight -->
                        <div class="col-md-6 mb-3">
                            ${this.renderTemperatureSection(metar, humidity, windChill)}
                            ${this.renderDaylightSection(sunTimes)}
                        </div>
                    </div>
                    
                    <!-- Raw METAR at the end -->
                    <div class="mt-3">
                        <label class="form-label text-muted small">RAW METAR</label>
                        <div class="alert alert-secondary font-monospace small mb-0">${metar.raw}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render top info cards (VFR, Weather, Wind, Visibility, Clouds, Pressure, Runway)
     */
    renderInfoCards(metar, bestRunway) {
        const category = metar.flightCategory || 'VFR';
        const categoryBg = this.getCategoryBgClass(category);
        const weatherIcon = this.getWeatherIcon(metar);

        return `
            <div class="row mb-4 g-2">
                <div class="col-6 col-md">
                    <div class="metar-info-card ${categoryBg}">
                        <div class="metar-info-value">${category}</div>
                        <div class="metar-info-label">${this.getCategoryLabel(category)}</div>
                    </div>
                </div>
                <div class="col-6 col-md">
                    <div class="metar-info-card metar-info-card-default">
                        <div class="metar-info-icon">${weatherIcon}</div>
                        <div class="metar-info-value">${metar.temperature}°C</div>
                        <div class="metar-info-label">${this.getWeatherLabel(metar)}</div>
                    </div>
                </div>
                <div class="col-6 col-md">
                    <div class="metar-info-card metar-info-card-default">
                        <div class="metar-info-value">${metar.wind.speed} kt</div>
                        <div class="metar-info-label">${metar.wind.direction}°</div>
                    </div>
                </div>
                <div class="col-6 col-md">
                    <div class="metar-info-card metar-info-card-default">
                        <div class="metar-info-value">${this.formatVisibility(metar.visibility)}</div>
                        <div class="metar-info-label">Visibility</div>
                    </div>
                </div>
                <div class="col-6 col-md">
                    <div class="metar-info-card metar-info-card-default">
                        <div class="metar-info-value">${this.formatCeiling(metar.clouds)}</div>
                        <div class="metar-info-label">Cloud Base</div>
                    </div>
                </div>
                <div class="col-6 col-md">
                    <div class="metar-info-card metar-info-card-default">
                        <div class="metar-info-value">${metar.altimeter || 'N/A'}</div>
                        <div class="metar-info-label">QNH (hPa)</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Wind Section with direction and speed
     */
    renderWindSection(metar, bestRunway) {
        const windDir = metar.wind.direction || 0;
        const windSpeed = metar.wind.speed || 0;
        const gustSpeed = metar.wind.gust || null;

        return `
            <div class="card aviation-card mb-3">
                <div class="card-header aviation-card-header">
                    <h6 class="mb-0">💨 Wind</h6>
                </div>
                <div class="card-body py-3">
                    <div class="row text-center">
                        <div class="col-6">
                            <div class="fs-3 fw-bold text-primary">${windDir}°</div>
                            <small class="text-muted">Direction</small>
                        </div>
                        <div class="col-6">
                            <div class="fs-3 fw-bold text-primary">${windSpeed} <small class="fs-6">kt</small></div>
                            <small class="text-muted">Speed</small>
                        </div>
                    </div>
                    ${gustSpeed ? `
                        <div class="text-center mt-2">
                            <span class="badge bg-warning text-dark">Gusts: ${gustSpeed} kt</span>
                        </div>
                    ` : ''}
                    ${bestRunway ? `
                        <hr class="my-2">
                        <div class="row text-center small">
                            <div class="col-6">
                                <span class="text-muted">Headwind:</span> <strong>${bestRunway.headwind.toFixed(0)} kt</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-muted">Crosswind:</span> <strong>${Math.abs(bestRunway.crosswind).toFixed(0)} kt</strong>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render Runway Wind Analysis Table
     */
    renderRunwayAnalysis(metar) {
        if (!this.runways || this.runways.length === 0) {
            return `
                <div class="card aviation-card">
                    <div class="card-header aviation-card-header">
                        <h6 class="mb-0">🛬 Runways</h6>
                    </div>
                    <div class="card-body text-center text-muted py-3">
                        <small>No runway data available</small>
                    </div>
                </div>
            `;
        }

        const windDir = metar.wind.direction || 0;
        const windSpeed = metar.wind.speed || 0;

        // Find best runway
        let bestId = null;
        let bestHeadwind = -Infinity;

        // Filter valid runways and calculate wind components
        const validRunways = this.runways.filter(rw => {
            const h1 = this.parseRunwayHeading(rw.le_ident);
            const h2 = this.parseRunwayHeading(rw.he_ident);
            return h1 !== null && h2 !== null;
        });

        validRunways.forEach(rw => {
            const heading1 = this.parseRunwayHeading(rw.le_ident);
            const heading2 = this.parseRunwayHeading(rw.he_ident);
            const calc1 = this.calculateRunwayWind(windDir, windSpeed, heading1);
            const calc2 = this.calculateRunwayWind(windDir, windSpeed, heading2);

            if (calc1.headwind > bestHeadwind) {
                bestHeadwind = calc1.headwind;
                bestId = rw.le_ident;
            }
            if (calc2.headwind > bestHeadwind) {
                bestHeadwind = calc2.headwind;
                bestId = rw.he_ident;
            }
        });

        const rows = validRunways.map(rw => {
            const heading1 = this.parseRunwayHeading(rw.le_ident);
            const heading2 = this.parseRunwayHeading(rw.he_ident);

            const calc1 = this.calculateRunwayWind(windDir, windSpeed, heading1);
            const calc2 = this.calculateRunwayWind(windDir, windSpeed, heading2);

            // Choose the one with more headwind (better for landing)
            const best = calc1.headwind > calc2.headwind ? calc1 : calc2;
            const bestRwId = calc1.headwind > calc2.headwind ? rw.le_ident : rw.he_ident;
            const crossIcon = best.crosswind >= 0 ? '→' : '←';
            const isActive = bestRwId === bestId;

            return `
                <tr class="${isActive ? 'table-success' : ''}">
                    <td><strong>${rw.le_ident}/${rw.he_ident}</strong></td>
                    <td>${heading1}°-${heading2}°</td>
                    <td>${crossIcon} ${Math.abs(best.crosswind).toFixed(0)} kt</td>
                    <td>${best.headwind.toFixed(0)} kt</td>
                    <td>${best.crosswindPct.toFixed(0)}%</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card aviation-card">
                <div class="card-header aviation-card-header">
                    <h6 class="mb-0">🛬 Runway Wind Analysis</h6>
                </div>
                <div class="card-body p-0">
                    <div class="small text-muted px-2 py-1 bg-light">
                        ⚠️ Based on wind calculation - Check official ATIS for active runway
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm aviation-table mb-0">
                            <thead>
                                <tr>
                                    <th>Id</th>
                                    <th>Heading</th>
                                    <th>Cross</th>
                                    <th>Head</th>
                                    <th>X-Wind %</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Temperature & Humidity Section
     */
    renderTemperatureSection(metar, humidity, windChill) {
        return `
            <div class="card aviation-card mb-3">
                <div class="card-header aviation-card-header">
                    <h6 class="mb-0">🌡️ Temperature & Humidity</h6>
                </div>
                <div class="card-body p-0">
                    <table class="table table-sm aviation-table mb-0">
                        <tbody>
                            <tr>
                                <td>Temperature</td>
                                <td class="text-end"><strong>${metar.temperature} °C</strong></td>
                            </tr>
                            <tr>
                                <td>Dew Point</td>
                                <td class="text-end"><strong>${metar.dewpoint} °C</strong></td>
                            </tr>
                            <tr>
                                <td>Relative Humidity</td>
                                <td class="text-end"><strong>${humidity}%</strong></td>
                            </tr>
                            <tr>
                                <td>Wind Chill</td>
                                <td class="text-end"><strong>${windChill} °C</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render Daylight Section
     */
    renderDaylightSection(sunTimes) {
        return `
            <div class="card aviation-card">
                <div class="card-header aviation-card-header">
                    <h6 class="mb-0">☀️ Daylight</h6>
                </div>
                <div class="card-body py-3">
                    <div class="row text-center">
                        <div class="col-4">
                            <div class="fs-5">🌅</div>
                            <div class="fw-bold">${sunTimes.sunrise}</div>
                            <small class="text-muted">Sunrise</small>
                        </div>
                        <div class="col-4">
                            <div class="fs-5">☀️</div>
                            <div class="fw-bold">${sunTimes.solarNoon}</div>
                            <small class="text-muted">Solar Noon</small>
                        </div>
                        <div class="col-4">
                            <div class="fs-5">🌇</div>
                            <div class="fw-bold">${sunTimes.sunset}</div>
                            <small class="text-muted">Sunset</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== Helper Functions ====================

    calculateSunTimes(lat, lon) {
        if (!lat || !lon || typeof SunCalc === 'undefined') {
            console.warn('SunCalc missing or invalid coords, using fallback');
            // Fallback to simple approximation if SunCalc not loaded or coords missing
            return { sunrise: '06:00', solarNoon: '12:00', sunset: '18:00', isDay: true };
        }

        const now = new Date();
        const times = SunCalc.getTimes(now, lat, lon);

        // Format helper
        const fmt = (date) => {
            return date.toLocaleTimeString('en-GB', { // Changed to en-GB for HH:MM format but English locale
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC'
            }) + 'Z'; // Show in UTC/Zulu time which is standard for aviation
        };

        return {
            sunrise: fmt(times.sunrise),
            solarNoon: fmt(times.solarNoon),
            sunset: fmt(times.sunset),
            isDay: now > times.sunrise && now < times.sunset
        };
    }

    formatTime(time) {
        if (!time) return '';
        return `${time}Z`;
    }

    getCategoryBgClass(category) {
        switch (category) {
            case 'VFR': return 'metar-info-card-vfr';
            case 'MVFR': return 'metar-info-card-mvfr';
            case 'IFR': return 'metar-info-card-ifr';
            case 'LIFR': return 'metar-info-card-lifr';
            default: return 'metar-info-card-default';
        }
    }

    getCategoryLabel(category) {
        switch (category) {
            case 'VFR': return 'Visual';
            case 'MVFR': return 'Marginal';
            case 'IFR': return 'Instrument';
            case 'LIFR': return 'Low IFR';
            default: return '';
        }
    }

    getWeatherIcon(metar) {
        const clouds = (metar.clouds || '').toUpperCase();
        if (clouds.includes('CB') || clouds.includes('TS')) return '⛈️';
        if (clouds.includes('OVC') || clouds.includes('BKN')) return '☁️';
        if (clouds.includes('SCT') || clouds.includes('FEW')) return '⛅';
        return '☀️';
    }

    getWeatherLabel(metar) {
        const clouds = (metar.clouds || '').toUpperCase();
        if (clouds.includes('CAVOK')) return 'CAVOK';
        if (clouds.includes('CLR') || clouds.includes('SKC')) return 'Clear';
        if (clouds.includes('OVC')) return 'Overcast';
        if (clouds.includes('BKN')) return 'Broken';
        if (clouds.includes('SCT') || clouds.includes('FEW')) return 'Scattered';
        return 'Clear';
    }

    formatVisibility(visData) {
        if (!visData) return 'N/A';

        // Handle the new structured object
        const { value, unit } = visData;

        if (value === 'CAVOK') return 'CAVOK';
        if (value === '10+' && unit === 'km') return '10+ km';

        // Return exactly what we parsed if it has a unit
        if (unit) {
            // If meters (4 digits), convert to km for readability if large, or keep meters
            if (unit === 'm') {
                const val = parseFloat(value);
                if (!isNaN(val)) {
                    if (val >= 5000) return `${(val / 1000).toFixed(0)} km`;
                    return `${val} m`;
                }
            }
            return `${value} ${unit}`;
        }

        // Legacy fallback or clean numbers
        const valNum = parseFloat(value);
        if (!isNaN(valNum)) {
            // Heuristic: if < 100, likely Miles or KM (already scaled). If > 100, likely Meteers.
            if (valNum < 100) return `${valNum} km`;
            if (valNum >= 9999) return '10+ km';
            return `${(valNum / 1000).toFixed(1)} km`;
        }

        return value;
    }

    formatCeiling(clouds) {
        if (!clouds) return 'None';
        if (clouds.toUpperCase().includes('CAVOK')) return 'CAVOK';
        if (clouds.toUpperCase().includes('CLR') || clouds.toUpperCase().includes('SKC')) return 'None';
        const match = clouds.match(/(\d{3})/);
        if (match) {
            return `${parseInt(match[1]) * 100} ft`;
        }
        return 'None';
    }

    calculateRunwayWind(windDir, windSpeed, rwHeading) {
        const diff = (windDir - rwHeading) * Math.PI / 180;
        const headwind = windSpeed * Math.cos(diff);
        const crosswind = windSpeed * Math.sin(diff);
        const crosswindPct = windSpeed > 0 ? (Math.abs(crosswind) / windSpeed) * 100 : 0;

        return { headwind, crosswind, crosswindPct };
    }

    calculateHumidity(temp, dewpoint) {
        if (temp === undefined || dewpoint === undefined) return 'N/A';
        const a = 17.27, b = 237.7;
        const alpha = ((a * dewpoint) / (b + dewpoint)) - ((a * temp) / (b + temp));
        const rh = Math.round(100 * Math.exp(alpha));
        return Math.min(100, Math.max(0, rh));
    }

    calculateWindChill(temp, windSpeed) {
        if (temp === undefined || windSpeed === undefined) return 'N/A';
        if (temp > 10 || windSpeed < 5) return temp;
        const windKmh = windSpeed * 1.852;
        const wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * temp * Math.pow(windKmh, 0.16);
        return Math.round(wc);
    }
}
