export class MapExportService {
    /**
     * Export map as A4 landscape PNG with all flight plan elements
     * Creates a temporary A4-sized map and uses leaflet-image to capture it
     * @param {L.Map} map - Original map (for reference)
     * @param {Array} mainWaypoints - Main route waypoints
     * @param {Array} alternateWaypoints - Alternate route waypoints
     */
    static async exportMapAtScale(map, mainWaypoints, alternateWaypoints = []) {
        console.log('📸 Starting A4 map export...');
        alert('Service started...'); // Debug alert

        if (typeof leafletImage === 'undefined') {
            alert('Error: leaflet-image library not loaded. Please refresh the page.');
            throw new Error('leaflet-image library not loaded');
        }

        let tempMap = null;
        let tempContainer = null;

        try {
            // 1. Calculate bounds from all waypoints
            const allWaypoints = [...mainWaypoints, ...alternateWaypoints];
            if (allWaypoints.length === 0) {
                alert('No waypoints to export. Please add waypoints to the map first.');
                return;
            }

            const bounds = this.calculateBounds(allWaypoints);
            console.log('Calculated bounds:', bounds);

            // 2. Create A4 landscape container (3508 × 2480 @ 300 DPI)
            tempContainer = document.createElement('div');
            tempContainer.id = 'temp-export-map';
            tempContainer.style.width = '3508px';
            tempContainer.style.height = '2480px';
            tempContainer.style.position = 'absolute';
            tempContainer.style.top = '-10000px';
            tempContainer.style.left = '-10000px';
            tempContainer.style.visibility = 'visible';
            document.body.appendChild(tempContainer);

            // 3. Create temporary map
            tempMap = L.map(tempContainer, {
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: false,
                zoomAnimation: false
            });

            // 4. Add tile layers
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }).addTo(tempMap);

            L.tileLayer('/api/openaip?z={z}&x={x}&y={y}', {
                maxZoom: 14,
                crossOrigin: 'anonymous',
                tms: false
            }).addTo(tempMap);

            // 5. Fit bounds to show entire route
            tempMap.fitBounds(bounds, {
                padding: [100, 100],
                maxZoom: 13,
                animate: false
            });

            tempMap.invalidateSize();

            // 6. Draw flight plan graphics
            console.log('Drawing flight plan elements...');
            this.drawFlightPlan(tempMap, mainWaypoints, alternateWaypoints);

            // 7. Wait for tiles to load
            console.log('⏳ Waiting for tiles...');
            await this.waitForTiles(tempMap, 8000);

            // 8. Capture with leaflet-image
            console.log('📷 Capturing A4 map...');
            const canvas = await new Promise((resolve, reject) => {
                leafletImage(tempMap, (err, canvas) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(canvas);
                    }
                });
            });

            // 9. Download
            const dataUrl = canvas.toDataURL('image/png');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `VFR-Flight-Plan-A4-${timestamp}.png`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('✅ Export successful!');
            alert('Map exported successfully in A4 format! Check your downloads folder.');

        } catch (error) {
            console.error('❌ Export failed:', error);
            alert(`Export failed: ${error.message}\n\nCheck the browser console (F12) for details.`);
            throw error;
        } finally {
            // Cleanup
            if (tempMap) {
                try {
                    tempMap.remove();
                } catch (e) {
                    console.warn('Map cleanup warning:', e);
                }
            }
            if (tempContainer && document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
        }
    }

    /**
     * Wait for tiles to load
     */
    static waitForTiles(map, timeout = 8000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const checkTiles = () => {
                const elapsed = Date.now() - startTime;
                const container = map.getContainer();
                const tiles = container.querySelectorAll('.leaflet-tile');

                let loadedCount = 0;
                tiles.forEach(tile => {
                    if (tile.complete && tile.naturalHeight !== 0) {
                        loadedCount++;
                    }
                });

                const allLoaded = tiles.length > 0 && loadedCount >= tiles.length * 0.85;

                if (allLoaded) {
                    console.log(`✓ ${loadedCount}/${tiles.length} tiles loaded`);
                    setTimeout(resolve, 1000);
                } else if (elapsed > timeout) {
                    console.warn(`⚠️ Timeout: ${loadedCount}/${tiles.length} tiles loaded`);
                    setTimeout(resolve, 500);
                } else {
                    setTimeout(checkTiles, 200);
                }
            };

            setTimeout(checkTiles, 500);
        });
    }

    /**
     * Draw all flight plan elements on the map
     */
    static drawFlightPlan(map, mainWaypoints, alternateWaypoints) {
        // Draw main route
        if (mainWaypoints.length > 0) {
            this.drawRoute(map, mainWaypoints, {
                routeColor: '#ff0000',
                circleColor: '#0066ff',
                labelBorder: '#0066ff'
            });
        }

        // Draw alternate route
        if (alternateWaypoints.length > 0) {
            this.drawRoute(map, alternateWaypoints, {
                routeColor: '#FF8C00',
                circleColor: '#FFD700',
                labelBorder: '#FF8C00'
            });
        }
    }

    /**
     * Draw a single route with all graphics
     */
    static drawRoute(map, waypoints, colors) {
        const latlngs = waypoints.map(wp => [wp.lat, wp.lon]);

        // 1. Route polyline
        L.polyline(latlngs, {
            color: colors.routeColor,
            weight: 3,
            opacity: 0.8
        }).addTo(map);

        // 2. Waypoints with circles and labels
        waypoints.forEach((wp, index) => {
            const pos = [wp.lat, wp.lon];

            // Circle marker (dot)
            L.circleMarker(pos, {
                radius: 6,
                fillColor: colors.circleColor,
                color: '#ffffff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            // 2NM radius circle
            L.circle(pos, {
                radius: 3704, // 2 NM in meters
                color: colors.circleColor,
                fillColor: colors.circleColor,
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.6
            }).addTo(map);

            // Waypoint label
            L.marker(pos, {
                icon: L.divIcon({
                    className: 'waypoint-label-export',
                    html: `<div style="
                        background: white; 
                        padding: 4px 8px; 
                        border: 2px solid ${colors.labelBorder}; 
                        border-radius: 4px; 
                        font-weight: bold; 
                        font-size: 14px;
                        white-space: nowrap;
                        box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                        color: #000;
                    ">${wp.name || 'WP ' + (index + 1)}</div>`,
                    iconSize: [0, 0],
                    iconAnchor: [-12, 12]
                })
            }).addTo(map);
        });
    }

    /**
     * Calculate bounds that include all waypoints
     */
    static calculateBounds(waypoints) {
        if (waypoints.length === 0) {
            return [[41.9, 12.5], [42.0, 12.6]];
        }

        const lats = waypoints.map(wp => wp.lat);
        const lons = waypoints.map(wp => wp.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        // Add 15% padding
        const latPadding = (maxLat - minLat) * 0.15 || 0.05;
        const lonPadding = (maxLon - minLon) * 0.15 || 0.05;

        return [
            [minLat - latPadding, minLon - lonPadding],
            [maxLat + latPadding, maxLon + lonPadding]
        ];
    }
}
