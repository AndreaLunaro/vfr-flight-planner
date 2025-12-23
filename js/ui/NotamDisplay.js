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
            'A': 'Aerodrome', 'C': 'Centro de control', 'F': 'Facilidades',
            'I': 'ILS/LOC/VOR', 'L': 'Iluminación', 'M': 'Movimiento',
            'N': 'Navegación', 'O': 'Obstáculo', 'P': 'Procedimientos',
            'R': 'Espacio aéreo', 'S': 'Servicio', 'T': 'Comunicaciones',
            'W': 'Navegación/Alerta',
            // Second letter - Condition
            'A': 'Disponible', 'B': 'Limitaciones', 'C': 'Cerrado',
            'H': 'Peligro', 'K': 'Operaciones', 'L': 'Iluminado',
            'O': 'Operacional', 'P': 'Operativo parcial', 'R': 'Restaurado',
            'S': 'Requerido', 'U': 'No disponible', 'W': 'Trabajo en progreso'
        };

        // Weather/obstacle abbreviations
        this.abbreviations = {
            'AD': 'Aeródromo', 'AGL': 'Sobre el nivel del suelo', 'AMSL': 'Sobre el nivel del mar',
            'AP': 'Aeropuerto', 'APRX': 'Aproximadamente', 'ATC': 'Control de tráfico aéreo',
            'AUTH': 'Autorizado', 'AVBL': 'Disponible', 'BTN': 'Entre',
            'CBND': 'Combinado', 'CL': 'Centro de línea', 'CLSD': 'Cerrado',
            'CMB': 'Subir', 'CNL': 'Cancelado', 'COORD': 'Coordinación',
            'CTR': 'Zona de control', 'DEP': 'Partida', 'DME': 'Equipo medidor de distancia',
            'EMERG': 'Emergencia', 'EQPT': 'Equipo', 'EST': 'Estimado',
            'EXC': 'Excepto', 'FLT': 'Vuelo', 'FM': 'Desde',
            'FNA': 'Aproximación final', 'FREQ': 'Frecuencia', 'FT': 'Pies',
            'GND': 'Tierra', 'GP': 'Glide Path', 'GPS': 'Sistema de posicionamiento global',
            'GS': 'Glide Slope', 'H24': '24 horas', 'HEL': 'Helicóptero',
            'HGT': 'Altura', 'HR': 'Hora', 'HZ': 'Hertz',
            'IAF': 'Fijo de aproximación inicial', 'IAP': 'Procedimiento de aproximación por instrumentos',
            'IFR': 'Reglas de vuelo por instrumentos', 'ILS': 'Sistema de aterrizaje por instrumentos',
            'IMC': 'Condiciones meteorológicas de vuelo por instrumentos',
            'INFO': 'Información', 'INTL': 'Internacional', 'INOP': 'Inoperativo',
            'KT': 'Nudos', 'LDG': 'Aterrizaje', 'LGT': 'Iluminado/Luz',
            'LOC': 'Localizador', 'LONG': 'Longitud', 'M': 'Metros',
            'MAINT': 'Mantenimiento', 'MAX': 'Máximo', 'MET': 'Meteorológico',
            'MHZ': 'Megahertz', 'MIN': 'Mínimo/Minutos', 'MNM': 'Mínimo',
            'MON': 'Lunes', 'MSA': 'Altitud mínima de sector', 'NAV': 'Navegación',
            'NDB': 'Radiofaro no direccional', 'NIL': 'Ninguno', 'NM': 'Millas náuticas',
            'NOF': 'Oficina internacional NOTAM', 'OBS': 'Obstáculo/Observación',
            'OPN': 'Abierto', 'OPR': 'Operación', 'PAPI': 'Indicador de trayectoria de aproximación de precisión',
            'PAX': 'Pasajeros', 'PERM': 'Permanente', 'PJE': 'Paracaidismo',
            'PPR': 'Permiso previo requerido', 'PROC': 'Procedimiento',
            'PSN': 'Posición', 'RAD': 'Radio', 'RCL': 'Línea central de pista',
            'REF': 'Referencia', 'RMK': 'Observación', 'RNAV': 'Navegación de área',
            'RTE': 'Ruta', 'RVR': 'Alcance visual en pista', 'RWY': 'Pista',
            'SER': 'Servicio', 'SFC': 'Superficie', 'SID': 'Salida instrumental estándar',
            'SR': 'Amanecer', 'SS': 'Atardecer', 'SSR': 'Radar secundario de vigilancia',
            'STAR': 'Llegada estándar por instrumentos', 'SVC': 'Servicio',
            'TAR': 'Radar de tránsito de aeródromo', 'TDZ': 'Zona de toma de contacto',
            'TFC': 'Tráfico', 'THR': 'Umbral', 'TIL': 'Hasta',
            'TMA': 'Área de control terminal', 'TWR': 'Torre', 'TWY': 'Calle de rodaje',
            'U/S': 'Fuera de servicio', 'UFN': 'Hasta nuevo aviso', 'UNLTD': 'Ilimitado',
            'UNL': 'Ilimitado', 'UTC': 'Tiempo Universal Coordinado', 'VFR': 'Reglas de vuelo visual',
            'VIS': 'Visibilidad', 'VMC': 'Condiciones meteorológicas visuales',
            'VOR': 'Radiofaro omnidireccional VHF', 'WEF': 'Con efecto desde',
            'WI': 'Dentro de', 'WIP': 'Trabajo en progreso', 'WKN': 'Debilitándose'
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
                            <p class="mb-2">⚠️ Nessun NOTAM disponibile</p>
                            <small>I dati NOTAM potrebbero non essere accessibili per questo aeroporto.<br>
                            Consulta sempre le fonti ufficiali prima del volo.</small>
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
                        ${source ? `<span class="badge bg-success text-white me-2">Fonte: ${source}</span>` : ''}
                        <span class="badge bg-light text-dark">${notamArray.length} attivi</span>
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
                    <span class="badge bg-warning text-dark">API non disponibile</span>
                </div>
                <div class="card-body">
                    <div class="alert alert-info mb-3">
                        <strong>ℹ️ Informazione:</strong> I dati NOTAM non sono accessibili tramite API pubblica.<br>
                        Utilizza una delle seguenti fonti ufficiali per consultare i NOTAM per <strong>${icao}</strong>:
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
                        <p class="mb-0">💡 <strong>Suggerimento:</strong> Per aeroporti italiani, usa <strong>Desk Aeronautico</strong> o <strong>ENAV</strong>.<br>
                        Per aeroporti USA, usa <strong>FAA PilotWeb</strong> o <strong>FAA NOTAM Search</strong>.</p>
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
                        <h6 class="text-primary mb-2">📖 Interpretazione</h6>
                        <div class="notam-description">${parsed.decodedDescription}</div>
                    </div>
                    
                    <!-- Parsed Fields -->
                    <div class="notam-parsed">
                        <h6 class="text-muted mb-2">📋 Dettagli</h6>
                        ${parsed.location ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📍 Aeroporto</span>
                            <span class="notam-parsed-value">${parsed.location}</span>
                        </div>
                        ` : ''}
                        ${parsed.qCode ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">🏷️ Codice Q</span>
                            <span class="notam-parsed-value">${parsed.qCode}</span>
                        </div>
                        ` : ''}
                        ${parsed.validity ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📅 Validità</span>
                            <span class="notam-parsed-value">${parsed.validity}</span>
                        </div>
                        ` : ''}
                        ${parsed.schedule ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">🕐 Orario</span>
                            <span class="notam-parsed-value">${parsed.schedule}</span>
                        </div>
                        ` : ''}
                        ${parsed.altitude ? `
                        <div class="notam-parsed-row">
                            <span class="notam-parsed-label">📐 Altitudine</span>
                            <span class="notam-parsed-value">${parsed.altitude}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Raw NOTAM -->
                    <div class="mt-3">
                        <label class="form-label text-muted small text-uppercase">NOTAM Originale</label>
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
            const end = validityMatch[2] === 'PERM' ? 'Permanente' : this.parseNotamDate(validityMatch[2]);
            validity = `Dal ${start} al ${end}`;
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
            const floor = floorMatch ? this.decodeAltitude(floorMatch[1]) : 'Superficie';
            const ceiling = ceilingMatch ? this.decodeAltitude(ceilingMatch[1]) : 'Illimitato';
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
                'MR': 'Pista', 'MT': 'Calle de rodaje', 'FA': 'Facilidades',
                'NV': 'Navegación', 'NA': 'Radioayuda', 'OB': 'Ostacolo',
                'SA': 'Spazio aereo', 'WU': 'Lavori'
            };

            const conditions = {
                'LC': 'chiusa', 'AS': 'fuori servizio', 'XX': 'vari',
                'LT': 'illuminazione limitata', 'AH': 'cambiato'
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

        // Replace common abbreviations with Italian explanations
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
                return { name: 'Pista', class: 'runway' };
            }
            if (text.includes('TWY') || text.includes('TAXIWAY')) {
                return { name: 'Taxiway', class: 'runway' };
            }
        }

        // Content-based detection
        if (text.includes('RWY') || text.includes('RUNWAY') || text.includes('TWY') || text.includes('TAXIWAY')) {
            return { name: 'Pista/Taxiway', class: 'runway' };
        }
        if (text.includes('OBST') || text.includes('CRANE') || text.includes('TOWER') || text.includes('WIP') || text.includes('OBSTACLE')) {
            return { name: 'Ostacolo', class: 'obstacle' };
        }
        if (text.includes('VOR') || text.includes('NDB') || text.includes('ILS') || text.includes('DME') || text.includes('GNSS') || text.includes('LOC')) {
            return { name: 'Navigazione', class: 'navigation' };
        }
        if (text.includes('CTR') || text.includes('TMA') || text.includes('AIRSPACE') || text.includes('PROHIBITED') || text.includes('RESTRICTED') || text.includes('TRA') || text.includes('TEMPO')) {
            return { name: 'Spazio Aereo', class: 'airspace' };
        }
        if (text.includes('FREQ') || text.includes('TWR') || text.includes('APP') || text.includes('ATIS') || text.includes('RADIO') || text.includes('COM')) {
            return { name: 'Comunicazioni', class: 'communication' };
        }
        if (text.includes('FUEL') || text.includes('SER') || text.includes('OPR')) {
            return { name: 'Servizi', class: 'other' };
        }
        return { name: 'Generale', class: 'other' };
    }

    /**
     * Decode schedule text
     */
    decodeSchedule(text) {
        if (!text) return '';

        let decoded = text
            .replace(/H24/g, '24 ore')
            .replace(/SR/g, 'Alba')
            .replace(/SS/g, 'Tramonto')
            .replace(/HJ/g, 'Ore diurne')
            .replace(/HN/g, 'Ore notturne')
            .replace(/MON/g, 'Lun')
            .replace(/TUE/g, 'Mar')
            .replace(/WED/g, 'Mer')
            .replace(/THU/g, 'Gio')
            .replace(/FRI/g, 'Ven')
            .replace(/SAT/g, 'Sab')
            .replace(/SUN/g, 'Dom')
            .replace(/DAILY/g, 'Giornaliero')
            .replace(/EXC/g, 'eccetto');

        return decoded;
    }

    /**
     * Decode altitude text
     */
    decodeAltitude(text) {
        if (!text) return '';

        const upper = text.toUpperCase();

        if (upper === 'SFC' || upper === 'GND') return 'Superficie';
        if (upper === 'UNL' || upper === 'UNLTD') return 'Illimitato';

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
