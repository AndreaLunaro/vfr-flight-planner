import { Constants } from '../utils/Constants.js';

export class GeocodingService {
    static async searchLocation(query, prioritizeItaly = false, signal = null) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        try {
            const fetchOptions = {
                headers: { 'User-Agent': 'VFR Flight Planner App' }
            };
            if (signal) {
                fetchOptions.signal = signal;
            }

            const response = await fetch(url, fetchOptions);
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
            if (error.name === 'AbortError') {
                // Request cancelled, rethrow to let caller handle it
                throw error;
            }
            console.error('Fetch error:', error);
            return [];
        }
    }

    static async geocodeWithNominatim(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'VFR Flight Planner App' }
        });

        if (!response.ok) {
            throw new Error(`Geocoding request failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.length === 0) {
            throw new Error(`No results found for: ${query}`);
        }

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }

    static async getElevation(lat, lon) {
        try {
            const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data.elevation && data.elevation.length > 0) {
                    const elevationMeters = data.elevation[0];
                    const elevationFeet = elevationMeters * Constants.metersToFeet;
                    // Add 1500ft and round up to nearest 100
                    return Math.ceil((elevationFeet + 1500) / 100) * 100;
                }
            }
        } catch (error) {
            console.warn('Elevation API error:', error);
        }
        // Failsafe: return base altitude only if API fails
        return Constants.baseAltitude;
    }

    /**
     * Reverse geocode coordinates to get feature name
     * Priority: Localities → POI → Natural features (within 500m radius)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<string|null>} Feature name or null
     */
    static async reverseGeocode(lat, lon) {
        try {
            // Request with 500m search radius and zoom for better precision
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&extratags=1&namedetails=1&zoom=18`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'VFR Flight Planner App' }
            });

            if (!response.ok) {
                console.warn('Reverse geocoding request failed:', response.status);
                return null;
            }

            const data = await response.json();

            // Priority 1: Localities (Cities/Towns first, then hamlets)
            if (data.address) {
                // First try cities and towns (higher priority)
                const city = data.address.city || data.address.town;
                if (city) {
                    console.log(`Reverse geocoded (${lat}, ${lon}) -> ${city} [city/town]`);
                    return city;
                }

                // Then suburbs and villages
                const suburb = data.address.suburb || data.address.village;
                if (suburb) {
                    console.log(`Reverse geocoded (${lat}, ${lon}) -> ${suburb} [suburb/village]`);
                    return suburb;
                }

                // Finally hamlets (lowest priority for localities)
                if (data.address.hamlet) {
                    console.log(`Reverse geocoded (${lat}, ${lon}) -> ${data.address.hamlet} [hamlet]`);
                    return data.address.hamlet;
                }
            }

            // Priority 2: POI (Tourism, Aeroway, Amenities)
            if (data.name && data.extratags) {
                if (data.extratags.tourism || data.extratags.aeroway || data.extratags.amenity) {
                    console.log(`Reverse geocoded (${lat}, ${lon}) -> ${data.name} [POI]`);
                    return data.name;
                }
            }

            // Priority 3: Natural features (mountains, lakes, water bodies)
            if (data.name && data.type) {
                const naturalTypes = ['peak', 'water', 'lake', 'dam', 'mountain', 'hill', 'bay', 'beach', 'forest', 'valley', 'river'];
                if (naturalTypes.includes(data.type)) {
                    console.log(`Reverse geocoded (${lat}, ${lon}) -> ${data.name} [${data.type}]`);
                    return data.name;
                }
            }

            console.log(`No feature found within radius for (${lat}, ${lon})`);
            return null;

        } catch (error) {
            console.warn('Reverse geocoding error:', error);
            return null;
        }
    }

    static getShortName(item) {
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
}
