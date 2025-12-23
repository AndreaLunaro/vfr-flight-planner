export class Aircraft {
    constructor() {
        this.database = {
            'TB9': {
                name: 'TB9',
                envelope: [[600, 500], [1280, 1060], [1100, 1060], [910, 980], [500, 550]],
                emptyWeight: 0,
                arms: [1.006, 1.155, 2.035, 1.075, 2.6],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                units: 'metric',
                xLabel: 'Momentum [kg x m]',
                yLabel: 'Mass [kg]',
                fuelConversion: 0.72,
                landingGearMoment: 0
            },
            'TB10': {
                name: 'TB10',
                envelope: [[600, 500], [1280, 1060], [1100, 1060], [910, 980], [500, 550]],
                emptyWeight: 727.37,
                arms: [1, 1.155, 2.035, 1.075, 2.6],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [AvGas liters]", "Luggage rack"],
                units: 'metric',
                xLabel: 'Momentum [kg x m]',
                yLabel: 'Mass [kg]',
                fuelConversion: 0.72,
                landingGearMoment: 0
            },
            'PA28': {
                name: 'PA28',
                envelope: [[85.5, 1400], [85.5, 2250], [90, 2780], [93, 2780], [93, 1400]],
                emptyWeight: 1824.44,
                arms: [89.48, 80.5, 118.1, 95, 142.9],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Rear seats", "Fuel on Board [liters]", "Luggage rack"],
                units: 'imperial',
                xLabel: 'Position CG [inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 819
            },
            'P68B': {
                name: 'P68B',
                envelope: [[10.2, 2650], [10.2, 3550], [12.8, 4350], [20.6, 4350], [20.6, 2650]],
                emptyWeight: 2957.57,
                arms: [16.492, -37.4, -5.7, 34.2, 30.3, 60.7],
                categories: ["AC Empty Weight", "Pilot+Copilot", "Passengers Row 1", "Passengers Row 2", "Fuel on Board [liters]", "Luggage"],
                units: 'imperial',
                xLabel: 'Position CG [inch]',
                yLabel: 'Mass [lbs]',
                fuelConversion: 1.59,
                landingGearMoment: 0
            }
        };
        this.currentAircraft = 'TB9';
        this.weightBalanceData = {
            envelope: [],
            arms: [],
            categories: [],
            weights: [],
            moments: [],
            chart: null
        };
    }

    getAircraft(code) {
        return this.database[code];
    }

    loadAircraftData(aircraftCode) {
        const aircraft = this.database[aircraftCode];
        if (!aircraft) {
            console.error('Aircraft not found:', aircraftCode);
            return null;
        }

        this.currentAircraft = aircraftCode;
        this.weightBalanceData.envelope = JSON.parse(JSON.stringify(aircraft.envelope));
        this.weightBalanceData.arms = [...aircraft.arms];
        this.weightBalanceData.categories = [...aircraft.categories];

        const totalCategories = aircraft.categories.length + 1;
        this.weightBalanceData.weights = new Array(totalCategories).fill(0);
        this.weightBalanceData.moments = new Array(totalCategories).fill(0);

        if (aircraft.emptyWeight > 0) {
            this.weightBalanceData.weights[0] = aircraft.emptyWeight;
        }

        return this.weightBalanceData;
    }

    isPointInsidePolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
