// Importiamo le costanti e i servizi necessari per la gestione della mappa
import { Constants } from '../utils/Constants.js';
import { GeocodingService } from '../services/GeocodingService.js';

/**
 * MapManager - Classe principale per gestire la mappa Leaflet e tutti i waypoint
 */
export class MapManager {
    constructor() {
        this.mapId = 'map';
        this.map = null;
        this.waypoints = [];
        this.alternateWaypoints = [];
        this.routeMode = 'main';
        this.routePolyline = null;
        this.alternatePolyline = null;
        this.openaipLayer = null;
        this.waypointModeEnabled = true;
        this.lastGeocodingCall = 0;

        setTimeout(() => {
            const exportBtn = document.getElementById('exportMapImage');
            if (exportBtn) {
                const newBtn = exportBtn.cloneNode(true);
                exportBtn.parentNode.replaceChild(newBtn, exportBtn);
                newBtn.addEventListener('click', () => this.exportMapImage());
            }
        }, 500);
    }

    async exportMapImage() {
        const btn = document.getElementById('exportMapImage');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '⏳ Foto...';
            btn.disabled = true;
        }

        let tempContainer = null;

        try {
            // 1. Setup A4 Landscape container
            const width = 1754;
            const height = 1240;

            tempContainer = document.createElement('div');
            tempContainer.style.width = width + 'px';
            tempContainer.style.height = height + 'px';
            // Use fixed positioning far off-screen to avoid visibility issues while ensuring rendering
            // z-index -9999 ensures it's behind everything
            tempContainer.style.position = 'fixed';
            tempContainer.style.left = '0';
            tempContainer.style.top = '0';
            tempContainer.style.zIndex = '-9999';
            // Explicitly visible to ensure rendering, rely on z-index to hide
            tempContainer.style.visibility = 'visible';
            tempContainer.style.backgroundColor = 'white';
            document.body.appendChild(tempContainer);

            // 2. Initialize Map
            const tempMap = L.map(tempContainer, {
                zoomControl: false,
                attributionControl: false,
                preferCanvas: false, // Standard DOM rendering often safer for snapshots
                fadeAnimation: false,
                zoomAnimation: false,
                markerZoomAnimation: false
            });

            // 3. Simple Layer Add (Sequential)
            const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                crossOrigin: 'Anonymous'
            }).addTo(tempMap);

            const openaip = L.tileLayer(`/api/openaip?z={z}&x={x}&y={y}`, {
                crossOrigin: 'Anonymous',
                tms: false
            }).addTo(tempMap);

            // 4. Overlays & Bounds
            const bounds = L.latLngBounds();
            const drawRoute = (waypoints, color) => {
                if (waypoints.length === 0) return;
                const latlngs = [];
                waypoints.forEach(wp => {
                    const pos = [wp.lat, wp.lon];
                    latlngs.push(pos);
                    bounds.extend(pos);

                    L.circleMarker(pos, { radius: 5, color: '#000', weight: 1, fillColor: '#fff', fillOpacity: 1 }).addTo(tempMap);
                    L.marker(pos, {
                        icon: L.divIcon({
                            className: 'temp-map-label',
                            html: `<div style="font-weight:bold; background:rgba(255,255,255,0.9); padding:2px 5px; border-radius:3px; border:1px solid #666; white-space:nowrap; font-size:12px;">${wp.name}</div>`,
                            iconSize: [null, null],
                            iconAnchor: [20, -10]
                        })
                    }).addTo(tempMap);
                    L.circle(pos, { color: color, fillColor: color === 'red' ? '#30f' : '#FFD700', fillOpacity: 0.1, weight: 1, radius: 2 * 1852 }).addTo(tempMap);
                });
                if (latlngs.length >= 2) L.polyline(latlngs, { color: color, weight: 3 }).addTo(tempMap);
            };

            drawRoute(this.waypoints, 'red');
            drawRoute(this.alternateWaypoints, '#FF8C00');

            // 5. Fit View
            if (bounds.isValid()) {
                tempMap.fitBounds(bounds, { padding: [50, 50] });
            } else if (this.map) {
                tempMap.setView(this.map.getCenter(), this.map.getZoom());
            } else {
                tempMap.setView([41.9, 12.5], 6);
            }
            // Force leaflet calculation
            tempMap.invalidateSize();

            // 6. Simple Wait (2s) - No Promise logic, just time
            await new Promise(r => setTimeout(r, 2000));

            // 7. Single Capture (No pre-warm)
            const dataUrl = await window.htmlToImage.toPng(tempContainer, {
                quality: 1.0,
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                cacheBust: true
            });

            // 8. Download
            const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const link = document.createElement('a');
            link.download = `VFR-Map-Export_${dateStr}.png`;
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            alert('Errore export: ' + error.message);
        } finally {
            if (tempContainer && document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    }

    init(mapId) {
        this.mapId = mapId;
        const tabEl = document.querySelector('button[data-bs-target="#visual-planning"]');
        if (tabEl) {
            if (tabEl.classList.contains('active')) this.initializeMap();
            tabEl.addEventListener('shown.bs.tab', () => {
                if (!this.map) this.initializeMap();
                setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 100);
            });
        }
    }

    initializeMap() {
        if (this.map) return;
        this.map = L.map(this.mapId).setView([41.9028, 12.4964], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            crossOrigin: true
        }).addTo(this.map);
        this.addWaypointToggleControl();
        this.addAlternateRouteToggleControl();
        this.map.on('click', async (e) => {
            if (this.waypointModeEnabled) await this.addWaypoint(e.latlng.lat, e.latlng.lng);
        });
    }

    addWaypointToggleControl() {
        const WaypointToggleControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-waypoint-toggle');
                const button = L.DomUtil.create('button', 'waypoint-toggle-btn active', container);
                button.innerHTML = '<span class="btn-icon">🔓</span> <span class="btn-text">Mode Active</span>';
                button.type = 'button';
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.waypointModeEnabled = !this.waypointModeEnabled;
                    if (this.waypointModeEnabled) {
                        button.innerHTML = '<span class="btn-icon">🔓</span> <span class="btn-text">Mode Active</span>';
                        button.classList.add('active');
                    } else {
                        button.innerHTML = '<span class="btn-icon">🔒</span> <span class="btn-text">Add Waypoints</span>';
                        button.classList.remove('active');
                    }
                    document.dispatchEvent(new CustomEvent('waypointModeToggled', { detail: { enabled: this.waypointModeEnabled } }));
                });
                return container;
            }
        });
        this.map.addControl(new WaypointToggleControl());
        this.addOpenAIPToggleControl();
    }

    addOpenAIPToggleControl() {
        const OpenAIPToggleControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-openaip-toggle');
                const button = L.DomUtil.create('button', 'openaip-toggle-btn active', container);
                button.innerHTML = '<span class="btn-icon">✈️</span> <span class="btn-text">Aero Maps</span>';
                button.type = 'button';
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.openaipLayer) {
                        this.map.removeLayer(this.openaipLayer);
                        this.openaipLayer = null;
                        button.classList.remove('active');
                    } else {
                        this.updateOpenAIPLayer();
                        button.classList.add('active');
                    }
                });
                return container;
            }
        });
        this.map.addControl(new OpenAIPToggleControl());
        this.updateOpenAIPLayer();
    }

    updateOpenAIPLayer() {
        if (!this.map) return;
        if (this.openaipLayer) {
            this.map.removeLayer(this.openaipLayer);
            this.openaipLayer = null;
        }
        this.openaipLayer = L.tileLayer(`/api/openaip?z={z}&x={x}&y={y}`, {
            attribution: '<a href="https://www.openaip.net/">© OpenAIP</a>',
            minZoom: 4,
            maxZoom: 14,
            tms: false
        }).addTo(this.map);
    }

    addAlternateRouteToggleControl() {
        const AlternateToggleControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-alternate-toggle');
                const button = L.DomUtil.create('button', 'alternate-toggle-btn', container);
                button.innerHTML = '<span class="btn-icon">🛤️</span> <span class="btn-text">Main Route</span>';
                button.type = 'button';
                button.style.backgroundColor = '#f8f9fa';
                button.style.border = '2px solid #ffc107';
                button.style.padding = '8px 12px';
                button.style.fontSize = '14px';
                button.style.fontWeight = 'bold';
                button.style.borderRadius = '4px';
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.routeMode = this.routeMode === 'main' ? 'alternate' : 'main';
                    if (this.routeMode === 'main') {
                        button.innerHTML = '<span class="btn-icon">🛤️</span> <span class="btn-text">Main Route</span>';
                        button.style.backgroundColor = '#f8f9fa';
                    } else {
                        button.innerHTML = '<span class="btn-icon">🔀</span> <span class="btn-text">Alternate Route</span>';
                        button.style.backgroundColor = '#ffc107';
                    }
                    document.dispatchEvent(new CustomEvent('routeModeToggled', { detail: { mode: this.routeMode } }));
                });
                return container;
            }
        });
        this.map.addControl(new AlternateToggleControl());
    }

    async addWaypoint(lat, lon, name = null) {
        const targetArray = this.routeMode === 'main' ? this.waypoints : this.alternateWaypoints;
        const index = targetArray.length + 1;
        let waypointName = name;
        let elevation = 0;

        if (!waypointName) {
            try {
                if (this.map) this.map.getContainer().style.cursor = 'wait';
                const now = Date.now();
                const timeSinceLastCall = now - (this.lastGeocodingCall || 0);
                if (timeSinceLastCall < 1000) await new Promise(r => setTimeout(r, 1000 - timeSinceLastCall));
                this.lastGeocodingCall = Date.now();
                waypointName = await GeocodingService.reverseGeocode(lat, lon) || `WP ${index}`;
                elevation = await GeocodingService.getElevation(lat, lon);
            } catch (e) {
                waypointName = `WP ${index}`;
            } finally {
                if (this.map) this.map.getContainer().style.cursor = '';
            }
        }

        const marker = L.marker([lat, lon], { draggable: true }).addTo(this.map);
        const popupContent = document.createElement('div');
        popupContent.className = 'text-center';
        const nameEl = document.createElement('div');
        nameEl.className = 'fw-bold mb-2';
        nameEl.textContent = waypointName;
        popupContent.appendChild(nameEl);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.innerHTML = '🗑️ Delete';
        deleteBtn.onclick = () => {
            const idx = targetArray.findIndex(wp => wp.marker === marker);
            if (idx !== -1) {
                this.removeWaypoint(idx, this.routeMode);
                document.dispatchEvent(new CustomEvent('waypointAdded'));
            }
        };
        popupContent.appendChild(deleteBtn);
        marker.bindPopup(popupContent);

        const circle = L.circle([lat, lon], {
            color: this.routeMode === 'main' ? 'blue' : '#DAA520',
            fillColor: this.routeMode === 'main' ? '#30f' : '#FFD700',
            fillOpacity: 0.1,
            radius: 2 * 1852
        }).addTo(this.map);

        const wpObj = { lat, lon, name: waypointName, marker, circle, elevation, routeType: this.routeMode };
        targetArray.push(wpObj);

        marker.on('dragend', async (e) => {
            const pos = e.target.getLatLng();
            circle.setLatLng(pos);
            wpObj.lat = pos.lat;
            wpObj.lon = pos.lng;
            nameEl.textContent = 'Updating...';
            marker.openPopup();
            try {
                wpObj.name = await GeocodingService.reverseGeocode(pos.lat, pos.lng) || `WP ${targetArray.indexOf(wpObj) + 1}`;
                wpObj.elevation = await GeocodingService.getElevation(pos.lat, pos.lng);
                nameEl.textContent = wpObj.name;
                document.dispatchEvent(new CustomEvent('waypointMoved', {
                    detail: {
                        index: targetArray.indexOf(wpObj),
                        lat: pos.lat, lon: pos.lng, name: wpObj.name,
                        elevation: wpObj.elevation, routeType: wpObj.routeType
                    }
                }));
            } catch (err) { nameEl.textContent = wpObj.name; }
            this.updateRoute();
        });

        this.updateRoute();
        document.dispatchEvent(new CustomEvent('waypointAdded', { detail: wpObj }));
    }

    removeWaypoint(index, routeType = 'main') {
        const targetArray = routeType === 'main' ? this.waypoints : this.alternateWaypoints;
        if (index >= 0 && index < targetArray.length) {
            const wp = targetArray[index];
            this.map.removeLayer(wp.marker);
            this.map.removeLayer(wp.circle);
            targetArray.splice(index, 1);
            this.updateRoute();
        }
    }

    clearAll() {
        [...this.waypoints, ...this.alternateWaypoints].forEach(wp => {
            if (wp.marker) this.map.removeLayer(wp.marker);
            if (wp.circle) this.map.removeLayer(wp.circle);
        });
        this.waypoints = [];
        this.alternateWaypoints = [];
        this.updateRoute();
    }

    updateRoute() {
        if (this.routeLine) this.map.removeLayer(this.routeLine);
        if (this.routeDecorator) this.map.removeLayer(this.routeDecorator);
        if (this.alternateRouteLine) this.map.removeLayer(this.alternateRouteLine);
        if (this.alternateRouteDecorator) this.map.removeLayer(this.alternateRouteDecorator);

        if (this.waypoints.length >= 2) {
            this.routeLine = L.polyline(this.waypoints.map(wp => [wp.lat, wp.lon]), { color: 'red', weight: 3 }).addTo(this.map);
            this.drawTicks(this.routeLine, 'main');
        }
        if (this.alternateWaypoints.length >= 2) {
            this.alternateRouteLine = L.polyline(this.alternateWaypoints.map(wp => [wp.lat, wp.lon]), { color: '#FF8C00', weight: 3 }).addTo(this.map);
            this.drawTicks(this.alternateRouteLine, 'alternate');
        }
    }

    drawTicks(polyline, routeType) {
        const decorator = L.polylineDecorator(polyline, {
            patterns: [{ offset: 0, repeat: '20px', symbol: L.Symbol.dash({ pixelSize: 10, pathOptions: { color: 'black', weight: 2 } }) }]
        }).addTo(this.map);
        if (routeType === 'main') this.routeDecorator = decorator;
        else this.alternateRouteDecorator = decorator;
    }

    reorderWaypoint(fromIndex, toIndex, routeType = 'main') {
        const targetArray = routeType === 'main' ? this.waypoints : this.alternateWaypoints;
        const [wp] = targetArray.splice(fromIndex, 1);
        targetArray.splice(toIndex, 0, wp);
        this.updateRoute();
    }

    getWaypointsData() {
        return this.waypoints.map((wp, i) => ({ name: wp.name, lat: wp.lat, lon: wp.lon, elevation: wp.elevation || 0, index: i }));
    }

    getAlternateWaypointsData() {
        return this.alternateWaypoints.map((wp, i) => ({ name: wp.name, lat: wp.lat, lon: wp.lon, elevation: wp.elevation || 0, index: i }));
    }
}
