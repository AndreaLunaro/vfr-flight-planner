export class MapExportService {
    /**
     * Export map as A4 landscape using off-screen temporary map
     * This eliminates flickering and ensures all tiles are loaded
     * @param {L.Map} map - Original Leaflet map instance (for waypoint data only)
     * @param {Array} waypoints - Array of waypoints
     */
    static async exportMapAtScale(map, waypoints) {
        if (!waypoints || waypoints.length === 0) {
            throw new Error('No waypoints to export');
        }

        console.log(`📸 Starting A4 landscape export (off-screen)...`);

        let tempContainer = null;
        let tempMap = null;

        try {
            // 1. Calculate bounds
            const bounds = this.calculateTightBounds(waypoints);

            // 2. Create INVISIBLE off-screen container (A4 landscape: 3508 × 2480)
            tempContainer = document.createElement('div');
            tempContainer.id = 'temp-export-map';
            tempContainer.style.width = '3508px';
            tempContainer.style.height = '2480px';
            tempContainer.style.position = 'absolute';
            tempContainer.style.top = '-10000px'; // Far off-screen
            tempContainer.style.left = '-10000px';
            tempContainer.style.zIndex = '-1';
            document.body.appendChild(tempContainer);

            // 3. Create temporary map
            tempMap = L.map(tempContainer, {
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: false,
                zoomAnimation: false,
                markerZoomAnimation: false
            });

            // 4. Add tile layer with crossOrigin
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                crossOrigin: true
            }).addTo(tempMap);

            // 5. Fit bounds
            tempMap.fitBounds(bounds, {
                padding: [150, 150],
                maxZoom: 15,
                animate: false
            });

            // 6. Draw flight plan elements
            this.drawFlightPlan(tempMap, waypoints);

            // 7. Wait for ALL tiles to load (critical for avoiding white tiles)
            console.log('⏳ Waiting for all tiles to load...');
            await this.waitForTiles(tempMap);

            // Extra buffer to ensure everything is fully rendered
            await this.waitForRender(500);

            // 8. Capture with html-to-image
            console.log('📷 Capturing...');
            const dataUrl = await htmlToImage.toPng(tempContainer, {
                width: 3508,
                height: 2480,
                backgroundColor: '#ffffff',
                skipAutoScale: true,
                cacheBust: true,
                style: {
                    transform: 'none'
                }
            });

            // 9. Download
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            this.downloadImage(dataUrl, `flight-plan-${timestamp}.png`);

            console.log('✅ Export successful!');

        } catch (error) {
            console.error('❌ Export failed:', error);
            throw error;
        } finally {
            // Cleanup
            if (tempMap) {
                tempMap.remove();
            }
            if (tempContainer) {
                document.body.removeChild(tempContainer);
            }
        }
    }

    /**
     * Wait for all map tiles to finish loading
     * @param {L.Map} map - Leaflet map instance
     * @returns {Promise} Resolves when all tiles are loaded
     */
    static waitForTiles(map) {
        return new Promise((resolve) => {
            // Check if tiles are already loaded
            const checkTilesLoaded = () => {
                const container = map.getContainer();
                const tiles = container.querySelectorAll('.leaflet-tile');
                let allLoaded = true;

                tiles.forEach(tile => {
                    if (!tile.complete) {
                        allLoaded = false;
                    }
                });

                if (allLoaded && tiles.length > 0) {
                    console.log(`✓ All ${tiles.length} tiles loaded`);
                    resolve();
                } else {
                    // Check again in 100ms
                    setTimeout(checkTilesLoaded, 100);
                }
            };

            // Start checking after a brief delay to let initial tiles start loading
            setTimeout(checkTilesLoaded, 500);
        });
    }

    /**
     * Draw flight plan on temporary map
     */
    static drawFlightPlan(map, waypoints) {
        // Route line
        const latlngs = waypoints.map(wp => [wp.lat, wp.lon]);
        L.polyline(latlngs, {
            color: '#ff0000',
            weight: 3,
            opacity: 0.8
        }).addTo(map);

        // Waypoints
        waypoints.forEach((wp, index) => {
            // Circle marker
            L.circleMarker([wp.lat, wp.lon], {
                radius: 6,
                fillColor: '#0066ff',
                color: '#ffffff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            // 2NM Circle
            L.circle([wp.lat, wp.lon], {
                radius: 3704, // 2 NM in meters
                color: '#0066ff',
                fillColor: '#0066ff',
                fillOpacity: 0.1,
                weight: 2
            }).addTo(map);

            // Label
            L.marker([wp.lat, wp.lon], {
                icon: L.divIcon({
                    className: 'waypoint-label-export',
                    html: `<div style="
                        background: white; 
                        padding: 4px 8px; 
                        border: 2px solid #0066ff; 
                        border-radius: 4px; 
                        font-weight: bold; 
                        font-size: 14px;
                        white-space: nowrap;
                        transform: translate(12px, -12px);
                        box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                    ">${wp.name || 'WP ' + (index + 1)}</div>`,
                    iconSize: [0, 0]
                })
            }).addTo(map);
        });
    }

    static calculateTightBounds(waypoints) {
        const lats = waypoints.map(wp => wp.lat);
        const lons = waypoints.map(wp => wp.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const latPadding = (maxLat - minLat) * 0.15 || 0.05;
        const lonPadding = (maxLon - minLon) * 0.15 || 0.05;
        return [
            [minLat - latPadding, minLon - lonPadding],
            [maxLat + latPadding, maxLon + lonPadding]
        ];
    }

    static async waitForRender(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
