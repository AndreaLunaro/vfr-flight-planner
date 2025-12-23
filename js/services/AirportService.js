export class AirportService {
    static airports = [];
    static runways = [];
    static frequencies = [];
    static dataLoaded = false;
    static loadingPromise = null;
    static dbName = 'VFRPlannerDB';
    static dbVersion = 1;

    static async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                resolve(null); // Fail gracefully
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data');
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }

    static async ensureDataLoaded() {
        if (this.dataLoaded) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = this.loadAllData();
        return this.loadingPromise;
    }

    static async loadAllData() {
        console.log('Checking local cache for airport data...');

        try {
            // Try loading from IndexedDB first
            const fromDB = await this.loadFromDB();
            if (fromDB) {
                console.log('Data loaded from IndexedDB cache!');
                this.airports = fromDB.airports || [];
                this.runways = fromDB.runways || [];
                this.frequencies = fromDB.frequencies || [];

                if (this.airports.length > 0) {
                    this.dataLoaded = true;
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load from DB, falling back to network:', e);
        }

        console.log('Cache missing or empty. Starting airport data download...');
        try {
            const [airportsCsv, runwaysCsv, frequenciesCsv] = await Promise.all([
                this.fetchCsv('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'),
                this.fetchCsv('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv'),
                this.fetchCsv('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airport-frequencies.csv')
            ]);

            console.log('Data downloaded, parsing...');
            this.airports = this.parseCsv(airportsCsv);
            this.runways = this.parseCsv(runwaysCsv);
            this.frequencies = this.parseCsv(frequenciesCsv);

            this.dataLoaded = true;
            console.log(`Loaded ${this.airports.length} airports, ${this.runways.length} runways, ${this.frequencies.length} frequencies.`);

            // Save to DB for next time (non-blocking)
            this.saveToDB({
                airports: this.airports,
                runways: this.runways,
                frequencies: this.frequencies
            }).catch(e => console.warn('Failed to save to DB:', e));

        } catch (error) {
            console.error('Failed to load airport data:', error);
            throw error;
        }
    }

    static async loadFromDB() {
        const db = await this.initDB();
        if (!db) return null;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['data'], 'readonly');
            const store = transaction.objectStore('data');

            // We store everything in one object or separate keys? 
            // Separate keys is better for memory but requires multiple gets. 
            // Let's assume we stored them as 'airports', 'runways', 'frequencies' keys.

            const airportsReq = store.get('airports');
            const runwaysReq = store.get('runways');
            const freqsReq = store.get('frequencies');

            let result = {};
            let count = 0;
            const checkDone = () => {
                count++;
                if (count === 3) {
                    if (result.airports && result.runways && result.frequencies) {
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                }
            };

            airportsReq.onsuccess = () => { result.airports = airportsReq.result; checkDone(); };
            runwaysReq.onsuccess = () => { result.runways = runwaysReq.result; checkDone(); };
            freqsReq.onsuccess = () => { result.frequencies = freqsReq.result; checkDone(); };

            airportsReq.onerror = () => checkDone();
            runwaysReq.onerror = () => checkDone();
            freqsReq.onerror = () => checkDone();
        });
    }

    static async saveToDB(data) {
        const db = await this.initDB();
        if (!db) return;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['data'], 'readwrite');
            const store = transaction.objectStore('data');

            store.put(data.airports, 'airports');
            store.put(data.runways, 'runways');
            store.put(data.frequencies, 'frequencies');

            transaction.oncomplete = () => {
                console.log('Airport data saved to IndexedDB successfully.');
                resolve();
            };
            transaction.onerror = (e) => reject(e);
        });
    }

    static async fetchCsv(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        return await response.text();
    }

    static parseCsv(csvText) {
        const lines = csvText.split('\n');
        const headers = this.parseCsvLine(lines[0]);
        const result = [];

        // Simple optimization: Pre-calculate header indices
        // Not strictly necessary for V8 but good practice

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = this.parseCsvLine(lines[i]);
            const entry = {};

            // Map headers to values
            for (let j = 0; j < headers.length; j++) {
                // Remove quotes if present
                const key = headers[j].replace(/^"|"$/g, '');
                let value = values[j] ? values[j].replace(/^"|"$/g, '') : '';
                entry[key] = value;
            }
            result.push(entry);
        }
        return result;
    }

    // Simple CSV line parser that handles quoted values containing commas
    static parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    static async getAirportInfo(icaoCode) {
        await this.ensureDataLoaded();

        const code = icaoCode.toUpperCase();
        const airport = this.airports.find(a => a.ident === code);

        if (!airport) return null;

        // Filter runways and frequencies for this airport
        // OurAirports uses 'id' in airports.csv to link runways (airport_ref) and frequencies (airport_ref)
        const airportId = airport.id;

        const airportRunways = this.runways.filter(r => r.airport_ref === airportId);
        const airportFrequencies = this.frequencies.filter(f => f.airport_ref === airportId);

        // Find nearby airports (simple radius check)
        const nearby = this.findNearbyAirports(parseFloat(airport.latitude_deg), parseFloat(airport.longitude_deg), 50); // 50km radius

        return {
            ...airport,
            runways: airportRunways,
            frequencies: airportFrequencies,
            nearby: nearby
        };
    }

    static findNearbyAirports(lat, lon, radiusKm) {
        // Include small, medium, and large airports (no scheduled service requirement)
        return this.airports
            .filter(a => (a.type === 'small_airport' || a.type === 'medium_airport' || a.type === 'large_airport'))
            .map(a => {
                const dist = this.calculateDistance(lat, lon, parseFloat(a.latitude_deg), parseFloat(a.longitude_deg));
                return { ...a, distance: dist };
            })
            .filter(a => a.distance > 0 && a.distance <= radiusKm)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10); // Increased from 5 to 10
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    static deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}
