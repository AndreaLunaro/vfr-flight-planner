/**
 * NotamDisplay - Enhanced NOTAM display component
 * Shows NOTAMs in both raw and fully parsed/decoded readable format
 */
export class NotamDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // NOTAM Q-code decoding tables
        this.qCodes = {
            // First letter - Subject
            'A': 'Aerodrome', 'C': 'Center', 'F': 'Facilities',
            'I': 'ILS/LOC/VOR', 'L': 'Lighting', 'M': 'Movement',
            'N': 'Navigation', 'O': 'Obstacle', 'P': 'Procedures',
            'R': 'Airspace', 'S': 'Service', 'T': 'Communications',
            'W': 'Warning',
            // Second letter - Condition
            'A': 'Available', 'B': 'Limitations', 'C': 'Closed',
            'H': 'Hazard', 'K': 'Operations', 'L': 'Lighted',
            'O': 'Operational', 'P': 'Partially operative', 'R': 'Restored',
            'S': 'Required', 'U': 'Unavailable', 'W': 'Work in progress'
        };

        // Weather/obstacle abbreviations
        this.abbreviations = {
            'AD': 'Aerodrome', 'AGL': 'Above Ground Level', 'AMSL': 'Above Mean Sea Level',
            'AP': 'Airport', 'APRX': 'Approximately', 'ATC': 'Air Traffic Control',
            'AUTH': 'Authorized', 'AVBL': 'Available', 'BTN': 'Between',
            'CBND': 'Combined', 'CL': 'Center Line', 'CLSD': 'Closed',
            'CMB': 'Climb', 'CNL': 'Cancelled', 'COORD': 'Coordinated',
            'CTR': 'Control Zone', 'DEP': 'Departure', 'DME': 'Distance Measuring Equipment',
            'EMERG': 'Emergency', 'EQPT': 'Equipment', 'EST': 'Estimated',
            'EXC': 'Except', 'FLT': 'Flight', 'FM': 'From',
            'FNA': 'Final Approach', 'FREQ': 'Frequency', 'FT': 'Feet',
            'GND': 'Ground', 'GP': 'Glide Path', 'GPS': 'Global Positioning System',
            'GS': 'Glide Slope', 'H24': '24 Hours', 'HEL': 'Helicopter',
            'HGT': 'Height', 'HR': 'Hour', 'HZ': 'Hertz',
            'IAF': 'Initial Approach Fix', 'IAP': 'Instrument Approach Procedure',
            'IFR': 'Instrument Flight Rules', 'ILS': 'Instrument Landing System',
            'IMC': 'Instrument Meteorological Conditions',
            'INFO': 'Information', 'INTL': 'International', 'INOP': 'Inoperative',
            'KT': 'Knots', 'LDG': 'Landing', 'LGT': 'Lighted/Light',
            'LOC': 'Localizer', 'LONG': 'Longitude', 'M': 'Meters',
            'MAINT': 'Maintenance', 'MAX': 'Maximum', 'MET': 'Meteorological',
            'MHZ': 'Megahertz', 'MIN': 'Minimum/Minutes', 'MNM': 'Minimum',
            'MON': 'Monday', 'MSA': 'Minimum Sector Altitude', 'NAV': 'Navigation',
            'NDB': 'Non-Directional Beacon', 'NIL': 'None', 'NM': 'Nautical Miles',
            'NOF': 'International NOTAM Office', 'OBS': 'Obstacle/Observation',
            'OPN': 'Open', 'OPR': 'Operating', 'PAPI': 'Precision Approach Path Indicator',
            'PAX': 'Passengers', 'PERM': 'Permanent', 'PJE': 'Parachute Jumping Exercise',
            'PPR': 'Prior Permission Required', 'PROC': 'Procedure',
            'PSN': 'Position', 'RAD': 'Radio', 'RCL': 'Runway Center Line',
            'REF': 'Reference', 'RMK': 'Remark', 'RNAV': 'Area Navigation',
            'RTE': 'Route', 'RVR': 'Runway Visual Range', 'RWY': 'Runway',
            'SER': 'Service', 'SFC': 'Surface', 'SID': 'Standard Instrument Departure',
            'SR': 'Sunrise', 'SS': 'Sunset', 'SSR': 'Secondary Surveillance Radar',
            'STAR': 'Standard Terminal Arrival Route', 'SVC': 'Service',
            'TAR': 'Terminal Area Radar', 'TDZ': 'Touchdown Zone',
            'TFC': 'Traffic', 'THR': 'Threshold', 'TIL': 'Until',
            'TMA': 'Terminal Control Area', 'TWR': 'Tower', 'TWY': 'Taxiway',
            'U/S': 'Unserviceable', 'UFN': 'Until Further Notice', 'UNLTD': 'Unlimited',
            'UNL': 'Unlimited', 'UTC': 'Coordinated Universal Time', 'VFR': 'Visual Flight Rules',
            'VIS': 'Visibility', 'VMC': 'Visual Meteorological Conditions',
            'VOR': 'VHF Omnidirectional Radio Range', 'WEF': 'With Effect From',
            'WI': 'Within', 'WIP': 'Work In Progress', 'WKN': 'Weakening'
        };
    }

    /**
     * Render the complete NOTAM display
     */
    render(notams, icao) {
        if (!this.container) return;

        // Check if we received an object with officialSources (no API data available)
        if (notams && notams.noDataAvailable && notams.officialSources) {
            this.renderNoDataWithLinks(notams, icao);
            return;
        }

        // Check if notams is an array and has content
        const notamArray = Array.isArray(notams) ? notams : (notams?.notams || []);

        if (!notamArray || notamArray.length === 0) {
            this.container.innerHTML = `
                <div class="card aviation-card">
                    <div class="card-header aviation-card-header">
                        <h5 class="mb-0">📢 NOTAM ${icao || ''}</h5>
                    </div>
                    <div class="card-body text-center py-4">
                        <div class="text-muted">
                            <p class="mb-2">⚠️ No NOTAMs available</p>
                            <small>NOTAM data might not be accessible for this airport.<br>
                            Always check official sources before flight.</small>
                        </div>
                        <div class="mt-3">
                            <a href="https://www.deskaeronautico.it/mappa/" target="_blank" class="btn btn-outline-primary btn-sm me-2">
                                🇮🇹 Desk Aeronautico
                            </a>
                            <a href="https://notams.aim.faa.gov/notamSearch/nsapp.html#/" target="_blank" class="btn btn-outline-secondary btn-sm">
                                🇺🇸 FAA NOTAM Search
                            </a>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Check if source indicates real data
        const source = notamArray[0]?.source;
        const isRealData = source && !source.includes('mock');

        this.container.innerHTML = `
            <div class="card aviation-card">
                <div class="card-header aviation-card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">📢 NOTAM ${icao || ''}</h5>
                    <div>
                        ${source ? `<span class="badge bg-success text-white me-2">Source: ${source}</span>` : ''}
                        <span class="badge bg-light text-dark">${notamArray.length} active</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="notam-list">
                        ${notamArray.map((notam, index) => this.renderNotamItem(notam, index)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Setup expand/collapse handlers
        this.setupEventListeners();
    }

    /**
     * Render the display when no NOTAM data is available, showing helpful links
     */
    renderNoDataWithLinks(data, icao) {
        const sources = data.officialSources || [];

        this.container.innerHTML = `
            <div class="card aviation-card">
                <div class="card-header aviation-card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">📢 NOTAM ${icao || ''}</h5>
                    <span class="badge bg-warning text-dark">API Unavailable</span>
                </div>
                <div class="card-body">
                    <div class="alert alert-info mb-3">
                        <strong>ℹ️ Information:</strong> NOTAM data is not accessible via public API.<br>
                        Use one of the following official sources to check NOTAMs for <strong>${icao}</strong>:
                    </div>
                    
                    <div class="row g-2">
                        ${sources.map(source => `
                            <div class="col-md-6">
                                <a href="${source.url}" target="_blank" class="notam-source-link btn btn-outline-primary w-100 text-start p-3">
                                    <strong>${source.name}</strong>
                                    <br><small class="text-muted">${source.description}</small>
                                </a>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-3 text-center text-muted small">
                        <p class="mb-0">💡 <strong>Tip:</strong> For Italian airports, use <strong>Desk Aeronautico</strong> or <strong>ENAV</strong>.<br>
                        For US airports, use <strong>FAA PilotWeb</strong> or <strong>FAA NOTAM Search</strong>.</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single NOTAM item
     */
    renderNotamItem(notam, index) {
        const parsed = this.parseNotam(notam);
        const categoryClass = `notam-category-${parsed.categoryClass}`;
        const isExpanded = index === 0; // First one expanded by default

        return `
            <div class="notam-item" data-notam-index="${index}">
                <div class="notam-header" onclick="this.parentElement.querySelector('.notam-body').classList.toggle('expanded'); this.querySelector('.notam-toggle-icon').classList.toggle('expanded');">
                    <div class="d-flex align-items-center gap-2">
                        <span class="notam-id">${parsed.id || 'NOTAM'}</span>
                        <span class="notam-category ${categoryClass}">${parsed.category}</span>
                        <span class="notam-summary">${parsed.summary}</span>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="notam-validity">${parsed.validityShort}</span>
                        <span class="notam-toggle-icon ${isExpanded ? 'expanded' : ''}">▼</span>
                    </div>
                </div>
                <div class="notam-body ${isExpanded ? 'expanded' : ''}">
                    <!-- Decoded Information -->
                    <div class="notam-decoded mb-3">
                        <h6 class="text-primary mb-2">📖 Interpretation</h6>
                        <div class="notam-description">${parsed.decodedDescription}</div>
                    </div>
                    
                    <!-- Parsed Fields -->
                    <div class="notam-parsed">
                        <h6 class="text-muted mb-2">📋 Details</h6>
                        ${parsed.location ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📍 Airport</span>
                            <span class="notam-parsed-value">${parsed.location}</span>
                        </div>
                        ` : ''}
                        ${parsed.qCode ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">🏷️ Q-Code</span>
                            <span class="notam-parsed-value">${parsed.qCode}</span>
                        </div>
                        ` : ''}
                        ${parsed.validity ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📅 Validity</span>
                            <span class="notam-parsed-value">${parsed.validity}</span>
                        </div>
                        ` : ''}
                        ${parsed.schedule ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">🕐 Schedule</span>
                            <span class="notam-parsed-value">${parsed.schedule}</span>
                        </div>
                        ` : ''}
                        ${parsed.altitude ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📐 Altitude</span>
                            <span class="notam-parsed-value">${parsed.altitude}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Raw NOTAM -->
                    <div class="mt-3">
                        <label class="form-label text-muted small text-uppercase">Raw NOTAM</label>
                        <div class="notam-raw">${notam.raw || notam}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Parse and decode raw NOTAM into structured data
     */
    parseNotam(notam) {
        const raw = typeof notam === 'string' ? notam : (notam.raw || notam.text || JSON.stringify(notam));

        // Extract NOTAM ID
        const idMatch = raw.match(/([A-Z]\d{4}\/\d{2})|(\w+\/\w+\/\d+)/);
        const id = idMatch ? idMatch[0] : '';

        // Extract Q-line information
        const qLineMatch = raw.match(/Q\)\s*([^)]+)/);
        let qCode = '';
        let qDecoded = '';
        if (qLineMatch) {
            const qParts = qLineMatch[1].split('/');
            qCode = qLineMatch[1];
            qDecoded = this.decodeQLine(qParts);
        }

        // Determine category based on Q-code and content
        const category = this.determineCategory(raw, qCode);

        // Extract and decode main text (E line)
        const textMatch = raw.match(/E\)\s*(.+?)(?=F\)|G\)|$)/s);
        const mainText = textMatch ? textMatch[1].trim() : raw;
        const decodedDescription = this.decodeNotamText(mainText);

        // Create summary (first 60 chars of decoded description)
        const summary = this.createSummary(mainText, category);

        // Extract validity dates
        const validityMatch = raw.match(/B\)\s*(\d{10})\s*C\)\s*(\d{10}|PERM)/);
        let validity = '';
        let validityShort = '';
        if (validityMatch) {
            const start = this.parseNotamDate(validityMatch[1]);
            const end = validityMatch[2] === 'PERM' ? 'Permanent' : this.parseNotamDate(validityMatch[2]);
            validity = `From ${start} to ${end}`;
            validityShort = `${this.parseNotamDateShort(validityMatch[1])} - ${validityMatch[2] === 'PERM' ? 'PERM' : this.parseNotamDateShort(validityMatch[2])}`;
        }

        // Extract schedule (D line)
        const scheduleMatch = raw.match(/D\)\s*([^E]+)/);
        let schedule = '';
        if (scheduleMatch) {
            schedule = this.decodeSchedule(scheduleMatch[1].trim());
        }

        // Extract altitude (F and G lines)
        const floorMatch = raw.match(/F\)\s*(\w+)/);
        const ceilingMatch = raw.match(/G\)\s*(\w+)/);
        let altitude = '';
        if (floorMatch || ceilingMatch) {
            const floor = floorMatch ? this.decodeAltitude(floorMatch[1]) : 'Surface';
            const ceiling = ceilingMatch ? this.decodeAltitude(ceilingMatch[1]) : 'Unlimited';
            altitude = `${floor} - ${ceiling}`;
        }

        // Extract location
        const locationMatch = raw.match(/A\)\s*(\w+)/);
        const location = locationMatch ? locationMatch[1] : '';

        return {
            id,
            category: category.name,
            categoryClass: category.class,
            summary,
            location,
            qCode: qDecoded || qCode,
            validity,
            validityShort,
            schedule,
            altitude,
            decodedDescription,
            raw
        };
    }

    /**
     * Decode Q-line parts
     */
    decodeQLine(qParts) {
        if (qParts.length < 2) return '';

        const fir = qParts[0];
        const code = qParts[1];

        let decoded = `FIR: ${fir}`;

        if (code && code.length >= 4) {
            // Q-code format: QXXXX (e.g., QMRLC = runway closed)
            const subject = code.substring(1, 3);
            const condition = code.substring(3, 5);

            const subjects = {
                'MR': 'Runway', 'MT': 'Taxiway', 'FA': 'Facilities',
                'NV': 'Navigation', 'NA': 'Navaid', 'OB': 'Obstacle',
                'SA': 'Airspace', 'WU': 'Works'
            };

            const conditions = {
                'LC': 'Closed', 'AS': 'Unserviceable', 'XX': 'Various',
                'LT': 'Limited Lighting', 'AH': 'Changed'
            };

            const subjectText = subjects[subject] || subject;
            const conditionText = conditions[condition] || condition;

            decoded += ` | ${subjectText} ${conditionText}`;
        }

        return decoded;
    }

    /**
     * Decode NOTAM text with abbreviation expansion
     */
    decodeNotamText(text) {
        if (!text) return '';

        let decoded = text.toUpperCase();

        // Replace common abbreviations with English explanations
        for (const [abbr, meaning] of Object.entries(this.abbreviations)) {
            const regex = new RegExp(`\\b${abbr}\\b`, 'g');
            decoded = decoded.replace(regex, `<span class="notam-abbr" title="${meaning}">${abbr}</span>`);
        }

        // Format the text for better readability
        decoded = decoded
            .replace(/\n+/g, '<br>')
            .replace(/\s{2,}/g, ' ');

        return decoded;
    }

    /**
     * Create a short summary from the NOTAM text
     */
    createSummary(text, category) {
        if (!text) return category.name;

        // Clean and truncate
        const clean = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const maxLen = 50;

        if (clean.length <= maxLen) return clean;
        return clean.substring(0, maxLen) + '...';
    }

    /**
     * Determine NOTAM category based on content
     */
    determineCategory(raw, qCode) {
        const text = raw.toUpperCase();
        const qUpper = qCode.toUpperCase();

        // Check Q-code first
        if (qUpper.includes('QMR') || qUpper.includes('QMT')) {
            if (text.includes('RWY') || text.includes('RUNWAY')) {
                return { name: 'Runway', class: 'runway' };
            }
            if (text.includes('TWY') || text.includes('TAXIWAY')) {
                return { name: 'Taxiway', class: 'runway' };
            }
        }

        // Content-based detection
        if (text.includes('RWY') || text.includes('RUNWAY') || text.includes('TWY') || text.includes('TAXIWAY')) {
            return { name: 'Runway/Taxiway', class: 'runway' };
        }
        if (text.includes('OBST') || text.includes('CRANE') || text.includes('TOWER') || text.includes('WIP') || text.includes('OBSTACLE')) {
            return { name: 'Obstacle', class: 'obstacle' };
        }
        if (text.includes('VOR') || text.includes('NDB') || text.includes('ILS') || text.includes('DME') || text.includes('GNSS') || text.includes('LOC')) {
            return { name: 'Navigation', class: 'navigation' };
        }
        if (text.includes('CTR') || text.includes('TMA') || text.includes('AIRSPACE') || text.includes('PROHIBITED') || text.includes('RESTRICTED') || text.includes('TRA') || text.includes('TEMPO')) {
            return { name: 'Airspace', class: 'airspace' };
        }
        if (text.includes('FREQ') || text.includes('TWR') || text.includes('APP') || text.includes('ATIS') || text.includes('RADIO') || text.includes('COM')) {
            return { name: 'Communications', class: 'communication' };
        }
        if (text.includes('FUEL') || text.includes('SER') || text.includes('OPR')) {
            return { name: 'Services', class: 'other' };
        }
        return { name: 'General', class: 'other' };
    }

    /**
     * Decode schedule text
     */
    decodeSchedule(text) {
        if (!text) return '';

        let decoded = text
            .replace(/H24/g, '24 Hours')
            .replace(/SR/g, 'Sunrise')
            .replace(/SS/g, 'Sunset')
            .replace(/HJ/g, 'Daytime')
            .replace(/HN/g, 'Nighttime')
            .replace(/MON/g, 'Mon')
            .replace(/TUE/g, 'Tue')
            .replace(/WED/g, 'Wed')
            .replace(/THU/g, 'Thu')
            .replace(/FRI/g, 'Fri')
            .replace(/SAT/g, 'Sat')
            .replace(/SUN/g, 'Sun')
            .replace(/DAILY/g, 'Daily')
            .replace(/EXC/g, 'Except');

        return decoded;
    }

    /**
     * Decode altitude text
     */
    decodeAltitude(text) {
        if (!text) return '';

        const upper = text.toUpperCase();

        if (upper === 'SFC' || upper === 'GND') return 'Surface';
        if (upper === 'UNL' || upper === 'UNLTD') return 'Unlimited';

        // FL format
        if (upper.startsWith('FL')) {
            const level = upper.substring(2);
            return `FL${level} (${parseInt(level) * 100}ft)`;
        }

        // Feet format
        if (upper.includes('FT')) {
            return upper.replace('FT', ' ft');
        }

        // Number only - assume feet
        if (/^\d+$/.test(upper)) {
            return `${upper} ft`;
        }

        return text;
    }

    /**
     * Parse NOTAM date format (YYMMDDHHMM)
     */
    parseNotamDate(dateStr) {
        if (!dateStr || dateStr.length < 10) return dateStr;
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const hour = dateStr.substring(6, 8);
        const min = dateStr.substring(8, 10);
        return `${day}/${month}/${year} ${hour}:${min}Z`;
    }

    /**
     * Parse NOTAM date to short format
     */
    parseNotamDateShort(dateStr) {
        if (!dateStr || dateStr.length < 10) return dateStr;
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const hour = dateStr.substring(6, 8);
        return `${day}/${month} ${hour}Z`;
    }

    /**
     * Setup event listeners for expand/collapse
     */
    setupEventListeners() {
        // Event listeners are inline in the HTML onclick handlers
    }
}
