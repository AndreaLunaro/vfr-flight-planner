export default async function handler(request, response) {
    const { icao } = request.query;
    const apiKey = process.env.OPENAIP_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'OpenAIP API key not configured' });
    }

    if (!icao) {
        return response.status(400).json({ error: 'Missing ICAO code parameter' });
    }

    const icaoCode = icao.toUpperCase();

    try {
        // OpenAIP Core API - Search airports by ICAO code
        // Documentation: https://api.core.openaip.net/api/
        const url = `https://api.core.openaip.net/api/airports?search=${icaoCode}&searchOptLoc=false&limit=10`;

        const airportResponse = await fetch(url, {
            headers: {
                'x-openaip-api-key': apiKey,
                'Accept': 'application/json'
            }
        });

        if (!airportResponse.ok) {
            console.error('OpenAIP API error:', airportResponse.status, await airportResponse.text());
            return response.status(airportResponse.status).json({
                error: 'OpenAIP API error',
                status: airportResponse.status
            });
        }

        const data = await airportResponse.json();

        // Find exact ICAO match
        const airport = data.items?.find(a =>
            a.icaoCode?.toUpperCase() === icaoCode ||
            a.identifier?.toUpperCase() === icaoCode
        );

        if (!airport) {
            return response.status(404).json({
                error: 'Airport not found in OpenAIP',
                icao: icaoCode
            });
        }

        // Format response to match our existing structure
        const formattedAirport = {
            source: 'OpenAIP',
            ident: airport.icaoCode || airport.identifier || icaoCode,
            iata_code: airport.iataCode || null,
            name: airport.name || 'Unknown',
            type: mapAirportType(airport.type),
            latitude_deg: airport.geometry?.coordinates?.[1] || airport.coordinates?.lat,
            longitude_deg: airport.geometry?.coordinates?.[0] || airport.coordinates?.lon,
            elevation_ft: airport.elevation ? Math.round(airport.elevation.value * 3.28084) : null, // Convert meters to feet
            iso_region: airport.country || '',
            municipality: airport.city || airport.municipality || '',

            // Runways
            runways: (airport.runways || []).map(rw => ({
                le_ident: rw.designator1 || rw.runwayDesignator1 || '',
                he_ident: rw.designator2 || rw.runwayDesignator2 || '',
                length_ft: rw.dimension?.length ? Math.round(rw.dimension.length * 3.28084) : 0,
                width_ft: rw.dimension?.width ? Math.round(rw.dimension.width * 3.28084) : 0,
                surface: mapSurfaceType(rw.surface?.type || rw.surfaceType),
                lighted: rw.lights ? '1' : '0',
                heading1: rw.trueHeading1 || (parseInt(rw.designator1) * 10) || 0,
                heading2: rw.trueHeading2 || (parseInt(rw.designator2) * 10) || 0
            })),

            // Frequencies
            frequencies: (airport.frequencies || []).map(f => ({
                type: mapFrequencyType(f.type),
                frequency_mhz: f.frequency?.toFixed(3) || f.value?.toFixed(3) || '',
                description: f.name || f.remarks || ''
            }))
        };

        // Set cache headers
        response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // 1 hour cache

        return response.status(200).json(formattedAirport);

    } catch (error) {
        console.error('OpenAIP proxy error:', error);
        return response.status(500).json({
            error: 'Failed to fetch from OpenAIP',
            message: error.message
        });
    }
}

// Helper functions to map OpenAIP types to our format
function mapAirportType(type) {
    const typeMap = {
        0: 'closed',
        1: 'small_airport',      // Airfield
        2: 'small_airport',      // Airfield with paved runway
        3: 'medium_airport',     // Airport
        4: 'large_airport',      // International Airport
        5: 'heliport',
        6: 'seaplane_base',
        7: 'small_airport',      // Ultra-light field
        8: 'small_airport'       // Glider site
    };
    return typeMap[type] || 'small_airport';
}

function mapSurfaceType(type) {
    const surfaceMap = {
        0: 'Unknown',
        1: 'GRAS',      // Grass
        2: 'GRVL',      // Gravel
        3: 'CONC',      // Concrete
        4: 'ASPH',      // Asphalt
        5: 'SAND',      // Sand
        6: 'DIRT',      // Dirt
        7: 'WATE',      // Water
        8: 'SNOW'       // Snow/Ice
    };
    return surfaceMap[type] || 'Unknown';
}

function mapFrequencyType(type) {
    const freqMap = {
        0: 'OTHER',
        1: 'ATIS',
        2: 'TWR',
        3: 'GND',
        4: 'APP',
        5: 'DEP',
        6: 'CTR',
        7: 'INFO',
        8: 'UNICOM',
        9: 'RDO',
        10: 'EMERG',
        11: 'AFIS'
    };
    return freqMap[type] || 'OTHER';
}
