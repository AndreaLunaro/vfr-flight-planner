/**
 * NOTAM API Proxy - Vercel Serverless Function
 * Fetches NOTAMs from FAA or alternative sources
 * Deployed at /api/notam?icao=LIRF
 */

export default async function handler(req, res) {
    const { icao } = req.query;

    if (!icao) {
        return res.status(400).json({ error: 'Missing icao parameter' });
    }

    const icaoCode = icao.toUpperCase();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        // Try FAA NOTAM API first (may work server-side)
        let notams = await tryFaaNotamApi(icaoCode);

        if (!notams || notams.length === 0) {
            // Try Eurocontrol EAD for European airports
            if (icaoCode.startsWith('L') || icaoCode.startsWith('E')) {
                notams = await tryEurocontrolApi(icaoCode);
            }
        }

        if (!notams || notams.length === 0) {
            // Try ICAO API
            notams = await tryIcaoApi(icaoCode);
        }

        // If all fail, return empty with info
        if (!notams || notams.length === 0) {
            return res.status(200).json({
                source: 'none',
                icao: icaoCode,
                notams: [],
                message: 'No NOTAMs available from any source. Please check official sources.',
                links: {
                    faa: 'https://notams.aim.faa.gov/notamSearch/nsapp.html#/',
                    eurocontrol: 'https://www.eurocontrol.int/service/digital-notam-service',
                    deskaeronautico: 'https://www.deskaeronautico.it/mappa/'
                }
            });
        }

        // Cache for 10 minutes
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        res.status(200).json({
            source: notams.source || 'api',
            icao: icaoCode,
            notams: notams.data || notams,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('NOTAM Proxy Error:', error);
        res.status(500).json({
            error: 'Failed to fetch NOTAM data',
            message: error.message,
            icao: icaoCode
        });
    }
}

/**
 * Try FAA NOTAM Search API
 */
async function tryFaaNotamApi(icao) {
    try {
        // FAA NOTAM Search endpoint - try direct API
        const searchUrl = `https://notams.aim.faa.gov/notamSearch/search`;

        const params = new URLSearchParams({
            searchType: '0',
            designatorsForLocation: icao,
            formatType: 'ICAO',
            retrieveLocId: icao,
            actionType: 'notamRetrievalByICAOs'
        });

        const response = await fetch(`${searchUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': 'VFR-Planner/1.0',
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            console.log(`FAA API returned ${response.status}`);
            return null;
        }

        const text = await response.text();

        // Try parsing as JSON
        try {
            const data = JSON.parse(text);
            if (data.notamList && data.notamList.length > 0) {
                return {
                    source: 'FAA',
                    data: data.notamList.map(n => ({
                        raw: n.traditionalMessage || n.icaoMessage || n.text || '',
                        id: n.notamNumber || '',
                        type: n.classification || '',
                        effectiveStart: n.effectiveStart || '',
                        effectiveEnd: n.effectiveEnd || ''
                    }))
                };
            }
        } catch (e) {
            // Try parsing as HTML and extract NOTAMs
            const notams = parseNotamsFromHtml(text);
            if (notams.length > 0) {
                return { source: 'FAA', data: notams };
            }
        }

        return null;
    } catch (error) {
        console.log('FAA API error:', error.message);
        return null;
    }
}

/**
 * Try Eurocontrol for European airports
 */
async function tryEurocontrolApi(icao) {
    try {
        // Eurocontrol doesn't have a public API, but we can try their website
        // This is a placeholder for future integration
        return null;
    } catch (error) {
        console.log('Eurocontrol error:', error.message);
        return null;
    }
}

/**
 * Try ICAO API (requires API key, might work with free tier)
 */
async function tryIcaoApi(icao) {
    try {
        const response = await fetch(
            `https://applications.icao.int/dataservices/api/notam-list?api_key=free&format=json&locations=${icao}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            return {
                source: 'ICAO',
                data: data.map(n => ({
                    raw: n.message || n.text || JSON.stringify(n),
                    id: n.id || '',
                    location: n.location || icao
                }))
            };
        }

        return null;
    } catch (error) {
        console.log('ICAO API error:', error.message);
        return null;
    }
}

/**
 * Parse NOTAMs from HTML response
 */
function parseNotamsFromHtml(html) {
    const notams = [];

    // Look for NOTAM patterns in HTML
    // Pattern: A####/YY or similar NOTAM IDs followed by content
    const notamPattern = /([A-Z]\d{4}\/\d{2})\s*NOTAM[CNRW]?\s*([\s\S]*?)(?=\n[A-Z]\d{4}\/\d{2}|$)/gi;

    let match;
    while ((match = notamPattern.exec(html)) !== null) {
        const id = match[1];
        const content = match[2].trim();

        if (content.length > 10) {
            notams.push({
                raw: `${id} NOTAM\n${content}`,
                id: id
            });
        }
    }

    // Also try to find PRE or CODE blocks with NOTAM content
    const prePattern = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
    while ((match = prePattern.exec(html)) !== null) {
        const content = match[1].replace(/<[^>]+>/g, '').trim();
        if (content.includes('NOTAM') && content.length > 50) {
            notams.push({
                raw: content,
                id: content.match(/[A-Z]\d{4}\/\d{2}/)?.[0] || ''
            });
        }
    }

    return notams;
}
