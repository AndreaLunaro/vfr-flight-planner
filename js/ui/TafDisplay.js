/**
 * TafDisplay - Enhanced graphical TAF forecast display component
 * Shows weather forecasts in an extended horizontal table format (like metar-taf.com)
 */
export class TafDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    /**
     * Render the complete TAF display
     */
    render(tafData) {
        if (!this.container || !tafData) return;

        // Use the new segments parsed by WeatherService if available, otherwise fallback
        const rawTaf = tafData.rawTAF || tafData.raw || '';
        const segments = tafData.segments || [rawTaf];

        const parsed = this.parseTafSegments(rawTaf, segments);

        this.container.innerHTML = `
            <div class="card aviation-card">
                <div class="card-header aviation-card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">📋 Previsioni (TAF)</h5>
                    <span class="badge bg-light text-dark">${parsed.validPeriod}</span>
                </div>
                <div class="card-body p-0">
                    <!-- Extended Timeline Table -->
                    <div class="taf-table-wrapper">
                        ${this.renderExtendedTable(parsed.periods)}
                    </div>
                    
                    <!-- Raw TAF -->
                    <div class="p-3 border-top">
                        <label class="form-label text-muted small text-uppercase mb-1">TAF Codice</label>
                        <div class="alert alert-secondary font-monospace small mb-0">${rawTaf}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render extended horizontal table (like metar-taf.com)
     */
    renderExtendedTable(periods) {
        if (periods.length === 0) {
            return '<div class="text-center text-muted py-4">Nessun dato previsione disponibile</div>';
        }

        // Build header row with time periods
        const headerCells = periods.map((p, i) => {
            const typeLabel = p.type !== 'main' ? `<div class="taf-type-label">${p.type}</div>` : '';
            return `<th class="taf-period-col">${typeLabel}<div class="taf-time-label">${p.timeLabel}</div></th>`;
        }).join('');

        // Build category row (VFR/IFR badges)
        const categoryCells = periods.map(p => {
            const bgClass = this.getCategoryClass(p.category);
            return `<td><span class="taf-cat-badge ${bgClass}">${p.category}</span></td>`;
        }).join('');

        // Build weather row (icons)
        const weatherCells = periods.map(p => {
            const icon = this.getWeatherIcon(p);
            const label = this.getWeatherLabel(p);
            return `<td class="taf-weather-cell"><div class="taf-icon">${icon}</div><div class="taf-weather-label">${label}</div></td>`;
        }).join('');

        // Build visibility row
        const visCells = periods.map(p => `<td>${p.visibility || '-'}</td>`).join('');

        // Build clouds row
        const cloudCells = periods.map(p => `<td>${p.clouds || '-'}</td>`).join('');

        // Build wind row (direction arrows)
        const windCells = periods.map(p => {
            const dir = p.wind?.direction;
            const arrow = dir === 'VRB' || dir === null ? '↻' : '↗';
            const rotation = dir === 'VRB' || dir === null ? 0 : (dir + 180);
            return `<td class="taf-wind-cell">
                <span class="taf-wind-arrow" style="transform: rotate(${rotation}deg)">${arrow}</span>
                <div>${dir || '-'}°</div>
            </td>`;
        }).join('');

        // Build wind speed row
        const speedCells = periods.map(p => {
            const speed = p.wind?.speed || '-';
            const gust = p.wind?.gust ? ` G${p.wind.gust}` : '';
            return `<td>${speed} kt${gust}</td>`;
        }).join('');

        // Build phenomena row (if any)
        const hasPhenomena = periods.some(p => p.weather && p.weather !== '-');
        const phenomenaCells = hasPhenomena ? periods.map(p => `<td>${p.weather !== '-' ? p.weather : ''}</td>`).join('') : '';

        return `
            <table class="table table-bordered taf-extended-table mb-0">
                <thead>
                    <tr>
                        <th class="taf-label-col">Tempo</th>
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>
                    <tr class="taf-row-category">
                        <td class="taf-label-col"><strong>Codice</strong></td>
                        ${categoryCells}
                    </tr>
                    <tr class="taf-row-weather">
                        <td class="taf-label-col"><strong>Meteo</strong></td>
                        ${weatherCells}
                    </tr>
                    <tr>
                        <td class="taf-label-col"><strong>Vista</strong></td>
                        ${visCells}
                    </tr>
                    <tr>
                        <td class="taf-label-col"><strong>Base nuvolosa</strong></td>
                        ${cloudCells}
                    </tr>
                    <tr class="taf-row-wind">
                        <td class="taf-label-col"><strong>Vento</strong></td>
                        ${windCells}
                    </tr>
                    <tr>
                        <td class="taf-label-col"><strong>Velocità</strong></td>
                        ${speedCells}
                    </tr>
                    ${hasPhenomena ? `
                    <tr>
                        <td class="taf-label-col"><strong>Fenomeni</strong></td>
                        ${phenomenaCells}
                    </tr>
                    ` : ''}
                </tbody>
            </table>
        `;
    }

    /**
     * Get CSS class for category badge
     */
    getCategoryClass(category) {
        switch (category) {
            case 'VFR': return 'taf-cat-vfr';
            case 'MVFR': return 'taf-cat-mvfr';
            case 'IFR': return 'taf-cat-ifr';
            case 'LIFR': return 'taf-cat-lifr';
            default: return 'taf-cat-default';
        }
    }

    /**
     * Parse raw TAF into structured data using pre-split segments
     */
    parseTafSegments(rawTaf, segments) {
        if (!segments || segments.length === 0) return { validPeriod: '', periods: [] };

        const periods = [];

        // Extract valid period from the first segment
        let validPeriod = '';
        const validMatch = segments[0].match(/(\d{4})\/(\d{4})/);

        let startDay = 0, startHour = 0, endDay = 0, endHour = 0;

        if (validMatch) {
            startDay = parseInt(validMatch[1].substring(0, 2));
            startHour = parseInt(validMatch[1].substring(2, 4));
            endDay = parseInt(validMatch[2].substring(0, 2));
            endHour = parseInt(validMatch[2].substring(2, 4));
            validPeriod = `Valido: ${validMatch[1].substring(0, 2)}/${startHour}:00 - ${validMatch[2].substring(0, 2)}/${endHour}:00 UTC`;
        }

        // Process each segment
        segments.forEach((segment, index) => {
            let type = 'main';
            let timeLabel = '';

            // Identify segment type
            if (segment.startsWith('BECMG')) {
                type = 'BECMG';
                const match = segment.match(/(\d{4})\/(\d{4})/);
                if (match) timeLabel = `${match[1].substring(2)}:00 → ${match[2].substring(2)}:00`;
                else timeLabel = 'Divenendo';
            } else if (segment.startsWith('TEMPO')) {
                type = 'TEMPO';
                const match = segment.match(/(\d{4})\/(\d{4})/);
                if (match) timeLabel = `${match[1].substring(2)}:00 - ${match[2].substring(2)}:00`;
                else timeLabel = 'Temporaneo';
            } else if (segment.match(/^FM\d{6}/)) {
                type = 'FM';
                const match = segment.match(/^FM(\d{2})(\d{2})(\d{2})/);
                if (match) {
                    timeLabel = `Da ${match[2]}:${match[3]}`;
                }
            } else if (segment.startsWith('PROB')) {
                type = 'PROB';
                // Handle PROB30 1200/1300 AND PROB30 TEMPO 1200/1300
                const match = segment.match(/^PROB(\d{2})\s+(?:(?:TEMPO|BECMG)\s+)?(\d{4})\/(\d{4})/);
                if (match) {
                    type = `PROB${match[1]}`;
                    timeLabel = `${match[2].substring(2)}:00 - ${match[3].substring(2)}:00`;
                }
                // If it includes TEMPO/BECMG, append to type label for clarity
                if (segment.includes('TEMPO')) type += ' TEMPO';
                if (segment.includes('BECMG')) type += ' BECMG';
            } else if (index === 0) {
                type = 'main';
                timeLabel = `${startHour}:00 - ${endHour}:00`;
            }

            const period = this.parseSection(segment, type, timeLabel);
            if (period) periods.push(period);
        });

        return { validPeriod, periods };
    }

    parseSection(content, type, timeLabel) {
        return {
            type,
            timeLabel,
            wind: this.parseWind(content),
            visibility: this.parseVisibility(content),
            clouds: this.parseClouds(content),
            weather: this.parseWeather(content),
            category: this.determineCategory(this.parseVisibility(content), this.parseClouds(content))
        };
    }

    parseWind(str) {
        const match = str.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT/);
        if (match) {
            return {
                direction: match[1] === 'VRB' ? 'VRB' : parseInt(match[1]),
                speed: parseInt(match[2]),
                gust: match[3] ? parseInt(match[3]) : null
            };
        }
        return { direction: null, speed: null, gust: null };
    }

    parseVisibility(str) {
        if (str.includes('CAVOK')) return '10+ km';
        if (str.includes('9999')) return '10+ km';
        if (str.includes('P6SM')) return '10+ km'; // USA format

        // Match 4 digits visibility (ICAO)
        const match = str.match(/(?:^|\s)(\d{4})(?:\s|$)/);
        if (match) {
            const vis = parseInt(match[1]);
            // Exclude valid years (2024, 2025) and time strings if possible, but regex boundary helps
            // Safe assumption for 4 digits in TAF usually means vis if not part of date group
            // However date groups usually have / e.g. 1012/1014.

            if (vis >= 9999) return '10+ km';
            if (vis >= 1000) return `${(vis / 1000).toFixed(0)} km`;
            return `${vis} m`;
        }

        // USA format (e.g. 10SM, 1 1/2SM) - simplified
        const matchSM = str.match(/(\d+(?:\/\d+)?)\s?SM/);
        if (matchSM) return `${matchSM[1]} SM`;

        return '-';
    }

    parseClouds(str) {
        if (str.includes('CAVOK')) return 'CAVOK';
        if (str.includes('SKC') || str.includes('NSC') || str.includes('CLR')) return 'Sereno';

        const cloudMatches = str.match(/(?:FEW|SCT|BKN|OVC)\d{3}(?:CB|TCU)?/g);
        if (cloudMatches && cloudMatches.length > 0) {
            return cloudMatches.map(m => {
                const parts = m.match(/(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?/);
                if (parts) {
                    const height = parseInt(parts[2]) * 100;
                    const suffix = parts[3] || '';
                    return `${parts[1]} ${height}${suffix}`;
                }
                return m;
            }).join(' ');
        }
        return '-';
    }

    parseWeather(str) {
        const phenomena = [];
        // Extract weather codes
        const wxRegex = /(?:^|\s)([-+])?(VC)?(TS|SH|FZ|BL|dr|mi|bc)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP)?(BR|FG|FU|VA|DU|SA|HZ|PY)?(PO|SQ|FC|SS|DS)?(?:$|\s)/g;
        // This is complex, let's use a simpler heuristic map for common codes

        if (str.includes('TS')) phenomena.push('Temporale');
        if (str.match(/[-+]?RA/)) phenomena.push('Pioggia');
        if (str.match(/[-+]?SN/)) phenomena.push('Neve');
        if (str.includes('FG')) phenomena.push('Nebbia');
        if (str.includes('BR')) phenomena.push('Foschia');
        if (str.match(/[-+]?SH/)) phenomena.push('Rovesci');
        if (str.includes('GR')) phenomena.push('Grandine');

        return phenomena.length > 0 ? [...new Set(phenomena)].join(', ') : '-';
    }

    determineCategory(visibility, clouds) {
        // Convert functionality remains the same
        let visKm = 10;
        if (visibility.includes('km')) {
            visKm = parseFloat(visibility);
        } else if (visibility.includes('m')) {
            visKm = parseInt(visibility) / 1000;
        } else if (visibility.includes('SM')) {
            // Rough conversion
            visKm = parseFloat(visibility) * 1.6;
        }

        let ceiling = 99999;
        const ceilingMatch = clouds.match(/(?:BKN|OVC)\s(\d+)/);
        if (ceilingMatch) {
            ceiling = parseInt(ceilingMatch[1]);
        }

        // Also check if cloud string contains the height directly like BKN030
        const directMatch = clouds.match(/(?:BKN|OVC)(\d{3})/);
        if (directMatch && ceiling === 99999) {
            ceiling = parseInt(directMatch[1]) * 100;
        }

        if (visKm < 1.6 || ceiling < 500) return 'LIFR';
        if (visKm < 5 || ceiling < 1000) return 'IFR';
        if (visKm < 8 || ceiling < 3000) return 'MVFR';
        return 'VFR';
    }

    getWeatherIcon(period) {
        return super.getWeatherIcon(period); // Wait, this class doesn't extend anything. Copy helper.
    }

    // Copy helpers from MetarDisplay logic (redundant but safe for isolation)
    getWeatherIcon(period) {
        const clouds = period.clouds || '';
        const weather = period.weather || '';

        if (weather.includes('Temporale')) return '⛈️';
        if (weather.includes('Neve')) return '❄️';
        if (weather.includes('Pioggia') || weather.includes('Rovesci')) return '🌧️';
        if (weather.includes('Nebbia')) return '🌫️';
        if (weather.includes('Foschia')) return '🌁';
        if (clouds.includes('OVC')) return '☁️';
        if (clouds.includes('BKN')) return '🌥️';
        if (clouds.includes('SCT') || clouds.includes('FEW')) return '⛅';
        if (clouds.includes('CAVOK') || clouds.includes('Sereno')) return '☀️';
        return '🌤️';
    }

    getWeatherLabel(period) {
        const clouds = period.clouds || '';
        if (clouds.includes('CAVOK')) return 'CAVOK';
        if (clouds.includes('Sereno')) return 'Sereno';
        if (clouds.includes('OVC')) return 'Coperto';
        if (clouds.includes('BKN')) return 'Nuvoloso';
        if (clouds.includes('SCT')) return 'Nubi sparse';
        if (clouds.includes('FEW')) return 'Poco nuvoloso';
        return '';
    }
}
