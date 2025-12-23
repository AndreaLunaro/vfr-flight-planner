// Importiamo i moduli principali dell'applicazione
// FlightData gestisce i dati del piano di volo (waypoints, carburante, ecc.)
// Aircraft si occupa dei dati dell'aeromobile selezionato
import { FlightData } from './core/FlightData.js';
import { Aircraft } from './core/Aircraft.js';
import { UIManager } from './ui/UIManager.js';

// Moduli specifici per la pianificazione visuale con mappa
import { MapManager } from './ui/MapManager.js';
import { VisualWaypointManager } from './ui/VisualWaypointManager.js';

// Servizio per recuperare informazioni sugli aeroporti
import { AirportService } from './services/AirportService.js';

// Aspettiamo che il DOM sia completamente caricato prima di inizializzare l'app
document.addEventListener('DOMContentLoaded', () => {
    // Creiamo le istanze principali dell'applicazione
    const flightData = new FlightData();
    const aircraft = new Aircraft();
    const uiManager = new UIManager(flightData, aircraft);

    // Inizializziamo la mappa per la pianificazione visuale
    // MapManager gestisce la mappa Leaflet e i layer aeronautici
    const mapManager = new MapManager();

    // VisualWaypointManager collega la mappa con l'interfaccia dei waypoint
    // Permette di aggiungere waypoint cliccando sulla mappa
    const visualWaypointManager = new VisualWaypointManager(mapManager);

    // Avviamo l'interfaccia utente e inizializziamo la mappa
    uiManager.init();
    mapManager.init('map');

    // Carichiamo i dati dell'aeromobile predefinito (TB9)
    aircraft.loadAircraftData(aircraft.currentAircraft);
    uiManager.initializeWeightBalanceTable();

    // Piccolo trucco per le prestazioni: pre-carichiamo i dati degli aeroporti in background
    // In questo modo quando l'utente apre il tab Meteo & Info, i dati sono già pronti
    // Aggiungiamo un delay di 1 secondo per non rallentare il caricamento iniziale dell'UI
    setTimeout(() => {
        AirportService.ensureDataLoaded().then(() => {
            console.log('Dati aeroporti caricati in background.');
        }).catch(err => console.error('Errore nel precaricamento dati aeroporti:', err));
    }, 1000);
});
