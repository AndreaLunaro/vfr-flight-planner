import { Calculator } from '../services/Calculator.js';
import { ExportService } from '../services/ExportService.js';
import { MapExportService } from '../services/MapExportService.js';

export class VisualWaypointManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.listElement = document.getElementById('visualWaypointList');
        this.alternateListElement = document.getElementById('visualAlternateWaypointList');
        this.clearButton = document.getElementById('clearVisualPlan');
        this.clearAlternateButton = document.getElementById('clearAlternatePlan');
        this.openaipInput = document.getElementById('openaip-key');
        this.applyOpenaipButton = document.getElementById('apply-openaip');

        // New UI elements
        this.calculateButton = document.getElementById('calculateVisualPlan');
        this.exportButton = document.getElementById('exportVisualPlan');
        this.exportMapButton = document.getElementById('exportMapImage');

        this.flightResults = [];
        this.alternateResults = [];
        this.fuelData = {};
        this.alternateFuelData = {};
        this.draggedIndex = null;
        this.draggedRouteType = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for map events
        document.addEventListener('waypointAdded', (e) => {
            this.renderList();
        });

        document.addEventListener('waypointMoved', (e) => {
            this.renderList();
        });

        document.addEventListener('waypointsReordered', (e) => {
            this.renderList();
        });

        document.addEventListener('routeModeToggled', (e) => {
            // Update UI to show which mode is active
            this.renderList();
        });

        // Clear button
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.mapManager.clearAll();
                this.renderList();
                this.clearResults();
            });
        }

        // Clear alternate button
        if (this.clearAlternateButton) {
            this.clearAlternateButton.addEventListener('click', () => {
                this.mapManager.clearAlternate();
                this.renderList();
            });
        }

        // Calculate flight plan
        if (this.calculateButton) {
            this.calculateButton.addEventListener('click', () => {
                this.calculateFlightPlan();
            });
        }

        // Export to Excel
        if (this.exportButton) {
            this.exportButton.addEventListener('click', () => {
                this.exportToExcel();
            });
        }

        // Export map as image
        if (this.exportMapButton) {
            this.exportMapButton.addEventListener('click', async () => {
                await this.exportMapImage();
            });
        }

        // OpenAIP settings (optional - only if UI elements exist)
        if (this.applyOpenaipButton && this.openaipInput) {
            this.applyOpenaipButton.addEventListener('click', () => {
                const key = this.openaipInput.value.trim();
                if (key) {
                    this.mapManager.setOpenAIPKey(key);
                }
            });
        }
    }



    renderList() {
        this.renderWaypointList(this.listElement, this.mapManager.waypoints, 'main');
        this.renderWaypointList(this.alternateListElement, this.mapManager.alternateWaypoints, 'alternate');
    }

    renderWaypointList(listElement, waypoints, routeType) {
        if (!listElement) return;

        listElement.innerHTML = '';

        if (waypoints.length === 0) {
            const emptyMsg = routeType === 'main' ?
                '<div class="text-center text-muted p-3">Enable waypoint mode and click on map</div>' :
                '<div class="text-center text-muted p-3">Switch to Alternate Route mode</div>';
            listElement.innerHTML = emptyMsg;
            return;
        }

        waypoints.forEach((wp, index) => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.draggable = true;
            item.style.cursor = 'move';
            item.dataset.index = index;
            item.dataset.routeType = routeType;

            // Add colored border to distinguish route type
            if (routeType === 'alternate') {
                item.style.borderLeft = '4px solid #ffc107';
            } else {
                item.style.borderLeft = '4px solid #007bff';
            }

            // Drag and drop events
            item.addEventListener('dragstart', (e) => {
                this.draggedIndex = index;
                this.draggedRouteType = routeType;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropIndex = parseInt(item.dataset.index);
                const dropRouteType = item.dataset.routeType;

                // Only allow reordering within the same route type
                if (this.draggedIndex !== null && this.draggedIndex !== dropIndex && this.draggedRouteType === dropRouteType) {
                    this.mapManager.reorderWaypoint(this.draggedIndex, dropIndex, routeType);
                }
                this.draggedIndex = null;
                this.draggedRouteType = null;
            });

            const info = document.createElement('div');
            info.style.flex = '1';

            // Create editable name input
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'form-control form-control-sm mb-1';
            nameInput.value = wp.name;
            nameInput.style.maxWidth = '200px';
            nameInput.style.backgroundColor = '#ffffff';
            nameInput.style.color = '#000000';
            nameInput.placeholder = 'Waypoint name';

            // Update name on change
            nameInput.addEventListener('change', (e) => {
                const newName = e.target.value.trim() || `WP ${index + 1}`;
                this.mapManager.updateWaypointName(index, newName, routeType);
            });

            // Prevent drag when editing
            nameInput.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            const coords = document.createElement('small');
            coords.textContent = `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`;
            coords.className = 'text-muted';

            info.appendChild(nameInput);
            info.appendChild(coords);

            const actions = document.createElement('div');

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-sm btn-danger ms-2';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.mapManager.removeWaypoint(index, routeType);
                this.renderList();
            };

            actions.appendChild(removeBtn);
            item.appendChild(info);
            item.appendChild(actions);

            listElement.appendChild(item);
        });
    }

    calculateFlightPlan() {
        const waypoints = this.mapManager.getWaypointsData();
        const alternateWaypoints = this.mapManager.getAlternateWaypointsData();

        if (waypoints.length < 2) {
            alert('You need at least 2 waypoints in the main route to calculate a flight plan.');
            return;
        }

        const flightSpeed = parseFloat(document.getElementById('visualFlightSpeed').value) || 90;
        const fuelConsumption = parseFloat(document.getElementById('visualFuelConsumption').value) || 30;

        // Calculate main route
        this.flightResults = this.calculateRoute(waypoints, flightSpeed);
        this.fuelData = Calculator.calculateFuel(this.flightResults, fuelConsumption);

        // Calculate alternate route if it exists
        if (alternateWaypoints.length >= 2) {
            this.alternateResults = this.calculateRoute(alternateWaypoints, flightSpeed);
            this.alternateFuelData = Calculator.calculateFuel(this.alternateResults, fuelConsumption);
        } else {
            this.alternateResults = [];
            this.alternateFuelData = {};
        }

        // Display results for both routes
        const totalDistance = this.flightResults.reduce((sum, r, i) => i > 0 ? sum + r.distance : sum, 0);
        const totalTime = this.flightResults.reduce((sum, r, i) => i > 0 ? sum + r.flightTime : sum, 0);

        this.displayResults(totalDistance, totalTime);

        // Enable export buttons
        if (this.exportButton) {
            this.exportButton.disabled = false;
        }
        if (this.exportMapButton) {
            this.exportMapButton.disabled = false;
        }
    }

    calculateRoute(waypoints, flightSpeed) {
        const results = [];

        // First waypoint
        results.push({
            fix: waypoints[0].name,
            route: '-',
            altitude: waypoints[0].elevation || 0,
            distance: 0,
            radial: '-',
            flightTime: 0
        });

        // Calculate for each leg
        for (let i = 1; i < waypoints.length; i++) {
            const prev = waypoints[i - 1];
            const curr = waypoints[i];

            const distance = Calculator.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
            const bearing = Calculator.calculateBearing(prev.lat, prev.lon, curr.lat, curr.lon);
            const flightTime = (distance / flightSpeed) * 60; // Convert to minutes

            results.push({
                fix: curr.name,
                route: bearing.toFixed(0),
                altitude: curr.elevation || 0,
                distance: distance,
                radial: bearing.toFixed(0),
                flightTime: flightTime
            });
        }

        return results;
    }

    displayResults(totalDistance, totalTime) {
        // Show summary section
        const summaryDiv = document.getElementById('visualFlightSummary');
        if (summaryDiv) {
            summaryDiv.style.display = 'block';
        }

        // Update main route summary
        document.getElementById('visualTotalDistance').textContent = totalDistance.toFixed(1) + ' NM';
        document.getElementById('visualFlightTime').textContent = totalTime.toFixed(0) + ' min';
        document.getElementById('visualTripFuel').textContent = this.fuelData.tripFuel + ' L';
        document.getElementById('visualContingency').textContent = this.fuelData.contingencyFuel + ' L';
        document.getElementById('visualReserve').textContent = this.fuelData.reserveFuel + ' L';
        document.getElementById('visualTotalFuel').textContent = this.fuelData.totalFuel + ' L';

        // Update alternate route summary if present
        const alternateSummaryDiv = document.getElementById('visualAlternateSummary');
        if (this.alternateResults && this.alternateResults.length >= 2 && alternateSummaryDiv) {
            alternateSummaryDiv.style.display = 'block';

            const alternateDistance = this.alternateResults.reduce((sum, r, i) => i > 0 ? sum + r.distance : sum, 0);
            const alternateTime = this.alternateResults.reduce((sum, r, i) => i > 0 ? sum + r.flightTime : sum, 0);

            document.getElementById('visualAlternateDistance').textContent = alternateDistance.toFixed(1) + ' NM';
            document.getElementById('visualAlternateTime').textContent = alternateTime.toFixed(0) + ' min';
            document.getElementById('visualAlternateFuel').textContent = this.alternateFuelData.tripFuel + ' L';

            // Calculate combined total fuel (main total + alternate trip)
            const combinedTotal = this.fuelData.totalFuel + this.alternateFuelData.tripFuel;
            document.getElementById('visualCombinedTotalFuel').textContent = combinedTotal.toFixed(1) + ' L';
        } else if (alternateSummaryDiv) {
            alternateSummaryDiv.style.display = 'none';
        }

        // Populate flight data table in map section
        this.populateFlightTable(totalDistance, totalTime);
    }

    populateFlightTable(totalDistance, totalTime) {
        const tableCard = document.getElementById('visualFlightDataCard');
        const tableBody = document.getElementById('visualFlightTableBody');

        if (!tableBody) return;

        // Show the table card
        if (tableCard) {
            tableCard.style.display = 'block';
        }

        // Clear existing rows
        tableBody.innerHTML = '';

        // Populate rows
        this.flightResults.forEach((result, index) => {
            const row = document.createElement('tr');

            // FIX
            const fixCell = document.createElement('td');
            fixCell.textContent = result.fix;
            row.appendChild(fixCell);

            // Route
            const routeCell = document.createElement('td');
            routeCell.textContent = index === 0 ? '-' : result.route + '°';
            row.appendChild(routeCell);

            // Altitude
            const altCell = document.createElement('td');
            altCell.textContent = Math.round(result.altitude || 0);
            row.appendChild(altCell);

            // Distance
            const distCell = document.createElement('td');
            distCell.textContent = index === 0 ? '-' : result.distance.toFixed(1);
            row.appendChild(distCell);

            // Radial
            const radialCell = document.createElement('td');
            radialCell.textContent = index === 0 ? '-' : result.radial + '°';
            row.appendChild(radialCell);

            // Flight Time
            const timeCell = document.createElement('td');
            timeCell.textContent = index === 0 ? '-' : result.flightTime.toFixed(0);
            row.appendChild(timeCell);

            tableBody.appendChild(row);
        });

        // Update totals
        document.getElementById('visualTableTotalDistance').textContent = totalDistance.toFixed(1) + ' NM';
        document.getElementById('visualTableTotalTime').textContent = totalTime.toFixed(0) + ' min';

        // Alternate route table (if exists)
        const alternateTableCard = document.getElementById('visualAlternateFlightDataCard');
        const alternateTableBody = document.getElementById('visualAlternateFlightTableBody');

        if (this.alternateResults && this.alternateResults.length >= 2 && alternateTableBody) {
            alternateTableCard.style.display = 'block';
            alternateTableBody.innerHTML = '';

            this.alternateResults.forEach((result, index) => {
                const row = document.createElement('tr');

                const fixCell = document.createElement('td');
                fixCell.textContent = result.fix;
                row.appendChild(fixCell);

                const routeCell = document.createElement('td');
                routeCell.textContent = index === 0 ? '-' : result.route + '\u00b0';
                row.appendChild(routeCell);

                const altCell = document.createElement('td');
                altCell.textContent = Math.round(result.altitude || 0);
                row.appendChild(altCell);

                const distCell = document.createElement('td');
                distCell.textContent = index === 0 ? '-' : result.distance.toFixed(1);
                row.appendChild(distCell);

                const radialCell = document.createElement('td');
                radialCell.textContent = index === 0 ? '-' : result.radial + '\u00b0';
                row.appendChild(radialCell);

                const timeCell = document.createElement('td');
                timeCell.textContent = index === 0 ? '-' : result.flightTime.toFixed(0);
                row.appendChild(timeCell);

                alternateTableBody.appendChild(row);
            });

            const alternateTotalDistance = this.alternateResults.reduce((sum, r, i) => i > 0 ? sum + r.distance : sum, 0);
            const alternateTotalTime = this.alternateResults.reduce((sum, r, i) => i > 0 ? sum + r.flightTime : sum, 0);

            document.getElementById('visualAlternateTotalDistance').textContent = alternateTotalDistance.toFixed(1) + ' NM';
            document.getElementById('visualAlternateTotalTime').textContent = alternateTotalTime.toFixed(0) + ' min';
        } else if (alternateTableCard) {
            alternateTableCard.style.display = 'none';
        }
    }

    clearResults() {
        const summaryDiv = document.getElementById('visualFlightSummary');
        if (summaryDiv) {
            summaryDiv.style.display = 'none';
        }

        // Hide flight data table
        const tableCard = document.getElementById('visualFlightDataCard');
        if (tableCard) {
            tableCard.style.display = 'none';
        }

        this.flightResults = [];
        this.fuelData = {};

        if (this.exportButton) {
            this.exportButton.disabled = true;
        }
    }

    async exportToExcel() {
        if (this.flightResults.length === 0) {
            alert('Please calculate the flight plan first.');
            return;
        }

        try {
            const flightData = {
                flightResults: this.flightResults,
                fuelData: this.fuelData,
                alternateResults: this.alternateResults || [],
                alternateFuelData: this.alternateFuelData || {}
            };

            // Generiamo prima l'Excel
            await ExportService.exportToExcel(flightData);

            // Piccolo delay per non sovrapporre i download
            await new Promise(resolve => setTimeout(resolve, 500));

            // Poi generiamo il PDF
            await ExportService.exportToPDF(flightData);

        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting to Excel. Please check the console for details.');
        }
    }

    async exportMapImage() {
        const waypoints = this.mapManager.getWaypointsData();

        if (waypoints.length === 0) {
            alert('Add waypoints to the map first.');
            return;
        }

        try {
            console.log('📸 Exporting map...');
            await MapExportService.exportMapAtScale(
                this.mapManager.map,
                waypoints,
                500000 // 1:500,000 scale
            );
        } catch (error) {
            console.error('Map export error:', error);
            alert('Error exporting map. Please check the console for details.');
        }
    }
}
