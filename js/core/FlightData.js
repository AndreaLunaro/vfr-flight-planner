export class FlightData {
    constructor() {
        this.waypoints = [];
        this.alternateWaypoints = [];
        this.flightResults = [];
        this.alternateResults = [];
        this.fuelData = {};
        this.alternateFuelData = {};
    }

    reset() {
        this.waypoints = [];
        this.alternateWaypoints = [];
        this.flightResults = [];
        this.alternateResults = [];
        this.fuelData = {};
        this.alternateFuelData = {};
    }
}
