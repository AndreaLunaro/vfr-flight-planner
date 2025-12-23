export class WeatherService {
    static async getMetar(icaoCode) {
        // Try local proxy first (Production / Vercel Dev)
        let url = `/api/weather?type=metar&ids=${icaoCode}`;
        try {
            const response = await fetch(url);
            if (response.status === 404) throw new Error('Proxy not found'); // Localhost without vercel dev
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.warn('Local proxy failed, trying public CORS proxy...', error);
            // Fallback to public CORS proxy (Localhost development)
            const targetUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoCode}&format=json`;
            url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                return data.length > 0 ? data[0] : null;
            } catch (fallbackError) {
                console.error('Error fetching METAR (fallback):', fallbackError);
                return null;
            }
        }
    }

    static async getTaf(icaoCode) {
        // Try local proxy first
        let url = `/api/weather?type=taf&ids=${icaoCode}`;
        try {
            const response = await fetch(url);
            if (response.status === 404) throw new Error('Proxy not found');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.warn('Local proxy failed, trying public CORS proxy...', error);
            // Fallback
            const targetUrl = `https://aviationweather.gov/api/data/taf?ids=${icaoCode}&format=json`;
            url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                return data.length > 0 ? data[0] : null;
            } catch (fallbackError) {
                console.error('Error fetching TAF (fallback):', fallbackError);
                return null;
            }
        }
    }

    static parseMetar(metar) {
        if (!metar) return null;

        let vis = metar.visib;
        let visUnit = null; // Don't assume unit yet

        // 1. Check for CAVOK
        const isCavok = (metar.clouds && metar.clouds.some(c => c.cover === 'CAVOK')) ||
            (metar.rawOb && metar.rawOb.includes('CAVOK'));

        if (isCavok) {
            vis = 'CAVOK';
            visUnit = '';
        } else if (metar.rawOb) {
            // 2. Prioritize Raw String Parsing
            // API often returns '6' (miles) for '9999' (10km+), which is confusing. 
            // We parse the raw string to get the actual reported value.

            // Regex for visibility:
            // - 9999 (10km+)
            // - 10SM, 5SM, 1/2SM (USA)
            // - 4 digits (e.g., 4000, 0800) -> Meters
            const visMatch = metar.rawOb.match(/\s(9999|CAVOK|10SM|\d{1,2}SM|\d\/\dSM|\d{4})\s/);

            if (visMatch) {
                const matchVal = visMatch[1];
                if (matchVal === '9999') {
                    vis = '10+';
                    visUnit = 'km';
                } else if (matchVal === 'CAVOK') {
                    vis = 'CAVOK';
                    visUnit = '';
                } else if (matchVal.endsWith('SM')) {
                    vis = matchVal;
                    visUnit = ''; // Unit is inside the string
                } else if (/^\d{4}$/.test(matchVal)) {
                    vis = parseInt(matchVal, 10);
                    visUnit = 'm';
                }
            } else {
                // No match in raw, fall back to API value but be careful
                if (vis === undefined || vis === null) {
                    vis = '10+'; // Default good if nothing found
                    visUnit = 'km';
                }
                // If API value exists, we use it, but we might interpret '6+' as 9999 if we didn't find raw match? 
                // Let's stick to API value if regex fails.
            }
        } else {
            // Fallback if no raw text
            visUnit = 'km';
        }

        // If after all this we have no unit and a number, assume km or API default
        if (visUnit === null && vis !== 'CAVOK') {
            // If vis is small (<100) and no unit, likely miles or km. 
            // Without raw match, hard to say. The regex should catch most standard cases.
            visUnit = 'km';
        }

        return {
            raw: metar.rawOb,
            flightCategory: metar.fltCat, // VFR, MVFR, IFR, LIFR
            wind: {
                direction: metar.wdir === 'VRB' ? 'Variable' : metar.wdir,
                speed: metar.wspd,
                gust: metar.wgst || null
            },
            visibility: { value: vis, unit: visUnit },
            clouds: metar.clouds ? metar.clouds.map(c => {
                // Formatting base to 3-digit hundreds for compatibility with MetarDisplay parser
                // API usually returns base in feet (e.g. 2500). We want "025"
                if (c.base) {
                    const hundreds = Math.round(c.base / 100);
                    const baseStr = hundreds.toString().padStart(3, '0');
                    return `${c.cover}${baseStr}`;
                }
                return c.cover; // e.g. CAVOK or CLR
            }).join(' ') : (isCavok ? 'CAVOK' : ''), // Ensure CAVOK is carried over to clouds if needed
            temperature: metar.temp,
            dewpoint: metar.dewp,
            altimeter: metar.altim,
            time: new Date(metar.reportTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    /**
     * Parsing of raw TAF text into structured segments
     * Breaks down BECMG, TEMPO, FM, etc.
     */
    static parseTaf(rawTaf) {
        if (!rawTaf) return null;

        // Clean up newlines and extra spaces
        const cleanTaf = rawTaf.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

        // Regex to split by keywords but keep the delimiter
        // Keywords: BECMG, TEMPO, FMxxxxxx, PROBxx
        // Crucial fix: Do NOT split safely if TEMPO/BECMG is preceded by PROB
        // Using negative lookbehind (?<!PROB\d{2}\s) to avoid splitting 'PROB30 TEMPO'
        const parts = cleanTaf.split(/(?=\s(?:(?<!PROB\d{2}\s)(?:BECMG|TEMPO)|FM\d{6}|PROB\d{2,4}))/g);

        return {
            rawTAF: rawTaf,
            segments: parts.map(part => part.trim()).filter(p => p.length > 0)
        };
    }

    /**
     * Fetch NOTAMs for an airport
     * Uses local Vercel proxy first, then fallback to CORS proxy
     */
    static async getNotams(icaoCode) {
        // Try 1: Local Vercel serverless function (Production)
        try {
            const response = await fetch(`/api/notam?icao=${icaoCode}`);
            if (response.ok) {
                const data = await response.json();
                if (data.notams && data.notams.length > 0) {
                    console.log(`NOTAMs loaded from ${data.source || 'API'}`);
                    return data.notams.map(n => ({
                        raw: n.raw || n.text || JSON.stringify(n),
                        source: data.source,
                        ...n
                    }));
                }
                // API returned no NOTAMs - return empty with links
                if (data.links) {
                    console.log('No NOTAMs found, check official sources:', data.links);
                }
            }
        } catch (error) {
            console.warn('Vercel NOTAM proxy not available:', error.message);
        }

        // Try 2: Public CORS proxy for FAA (Localhost fallback)
        try {
            const faaUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://notams.aim.faa.gov/notamSearch/search?searchType=0&designatorsForLocation=${icaoCode}&formatType=ICAO`)}`;
            const response = await fetch(faaUrl);

            if (response.ok) {
                const text = await response.text();

                // Try parsing as JSON
                try {
                    const data = JSON.parse(text);
                    if (data.notamList && data.notamList.length > 0) {
                        return data.notamList.map(n => ({
                            raw: n.traditionalMessage || n.icaoMessage || n.text || '',
                            source: 'FAA',
                            ...n
                        }));
                    }
                } catch (e) {
                    // Try parsing as HTML
                    const notams = this.parseNotamText(text);
                    if (notams.length > 0) {
                        return notams.map(n => ({ ...n, source: 'FAA-HTML' }));
                    }
                }
            }
        } catch (error) {
            console.warn('FAA CORS proxy failed:', error.message);
        }

        // Try 3: ICAO API (might work)
        try {
            const icaoUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://applications.icao.int/dataservices/api/notam?api_key=free&format=json&locations=${icaoCode}`)}`;
            const response = await fetch(icaoUrl);

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.map(n => ({
                        raw: n.text || n.message || JSON.stringify(n),
                        source: 'ICAO',
                        ...n
                    }));
                }
            }
        } catch (error) {
            console.warn('ICAO API failed:', error.message);
        }

        // All sources failed - return mock data with clear indication
        console.warn('All NOTAM sources failed, returning demo data for', icaoCode);
        return this.getMockNotams(icaoCode);
    }

    /**
     * Parse NOTAM text from HTML response
     */
    static parseNotamText(htmlText) {
        const notams = [];
        // Look for NOTAM patterns in the text
        const notamMatches = htmlText.match(/[A-Z]\d{4}\/\d{2}\s+NOTAM[\s\S]*?(?=\n[A-Z]\d{4}\/\d{2}|$)/g);

        if (notamMatches) {
            notamMatches.forEach(match => {
                notams.push({ raw: match.trim() });
            });
        }

        return notams;
    }

    /**
     * Return empty NOTAMs with helpful links when API is unavailable
     * Instead of fake data, we provide links to official sources
     */
    static getMockNotams(icaoCode) {
        // Return empty array with metadata indicating no data available
        // The NotamDisplay component will show helpful links
        return {
            noDataAvailable: true,
            icao: icaoCode,
            notams: [],
            message: 'NOTAM data not available via API',
            officialSources: [
                {
                    name: 'FAA PilotWeb',
                    url: `https://pilotweb.nas.faa.gov/PilotWeb/notamRetrievalByICAOAction.do?method=displayByICAOs&reportType=RAW&formatType=DOMESTIC&retrieveLocId=${icaoCode}&actionType=notamRetrievalByICAOs`,
                    description: 'FAA Official NOTAM Search (USA airports)'
                },
                {
                    name: 'FAA NOTAM Search',
                    url: 'https://notams.aim.faa.gov/notamSearch/nsapp.html#/',
                    description: 'New FAA NOTAM Search Interface'
                },
                {
                    name: 'Desk Aeronautico',
                    url: 'https://www.deskaeronautico.it/mappa/',
                    description: 'Italian NOTAM Map (aeroporti italiani)'
                },
                {
                    name: 'ENAV Briefing',
                    url: 'https://www.enav.it/pib',
                    description: 'Italian Pre-flight Information Bulletin'
                },
                {
                    name: 'Eurocontrol EAD',
                    url: 'https://www.ead.eurocontrol.int/',
                    description: 'European AIS Database (requires registration)'
                }
            ]
        };
    }
}

