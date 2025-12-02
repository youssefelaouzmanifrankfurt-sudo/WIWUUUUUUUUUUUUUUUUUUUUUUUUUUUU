// src/utils/storage.js
const fs = require('fs');
const path = require('path');

// KONFIGURATION PFADE
const SERVER_DATA_DIR = 'C:\\weeeeeee_data';
const CLIENT_DATA_DIR = 'Z:\\'; 

const DB_FILENAME = 'inventory.json';
const TASKS_FILENAME = 'tasks.json';
const EXT_FILENAME = 'imported.json';
const HISTORY_FILENAME = 'history.json';
const SETTINGS_FILENAME = 'settings.json';
const STOCK_FILENAME = 'stock.json';

// Ermittelt den korrekten Pfad zur Laufzeit
function getBasePath() {
    // 1. Bin ich der Server?
    if (fs.existsSync(SERVER_DATA_DIR)) {
        return SERVER_DATA_DIR;
    }
    // 2. Bin ich ein Client? (Netzlaufwerk)
    // Wir prüfen, ob wir wirklich drauf zugreifen können
    try {
        if (fs.existsSync(CLIENT_DATA_DIR)) {
            return CLIENT_DATA_DIR;
        }
    } catch(e) {}
    
    // 3. Fallback (Notfall): Lokaler Ordner
    const localFallback = path.join(__dirname, '../../data');
    if (!fs.existsSync(localFallback)) fs.mkdirSync(localFallback, { recursive: true });
    return localFallback;
}

// Pfad einmalig ermitteln und anzeigen
const ACTIVE_PATH = getBasePath();
const MODE = (ACTIVE_PATH === SERVER_DATA_DIR) ? "SERVER (Master)" : 
             (ACTIVE_PATH === CLIENT_DATA_DIR) ? "CLIENT (Worker Z:)" : "LOKAL (Fallback - Z: fehlt!)";

console.log("------------------------------------------------");
console.log(`[STORAGE] Speicherort: ${ACTIVE_PATH}`);
console.log(`[STORAGE] Modus:       ${MODE}`);
console.log("------------------------------------------------");

const getDbPath = () => path.join(ACTIVE_PATH, DB_FILENAME);
const getTasksPath = () => path.join(ACTIVE_PATH, TASKS_FILENAME);
const getExtPath = () => path.join(ACTIVE_PATH, EXT_FILENAME);
const getHistoryPath = () => path.join(ACTIVE_PATH, HISTORY_FILENAME);
const getSettingsPath = () => path.join(ACTIVE_PATH, SETTINGS_FILENAME);
const getStockPath = () => path.join(ACTIVE_PATH, STOCK_FILENAME);

function init() {
    try {
        if (!fs.existsSync(getDbPath())) fs.writeFileSync(getDbPath(), '[]');
        if (!fs.existsSync(getTasksPath())) fs.writeFileSync(getTasksPath(), '[]');
        if (!fs.existsSync(getExtPath())) fs.writeFileSync(getExtPath(), '[]');
        if (!fs.existsSync(getHistoryPath())) fs.writeFileSync(getHistoryPath(), '[]');
        if (!fs.existsSync(getSettingsPath())) fs.writeFileSync(getSettingsPath(), '{}');
        if (!fs.existsSync(getStockPath())) fs.writeFileSync(getStockPath(), '[]');
    } catch (e) { 
        console.error("[STORAGE ERROR] Init fehlgeschlagen:", e.message); 
    }
}

// --- LADE / SPEICHER FUNKTIONEN ---

const loadDB = () => { try { const p = getDbPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : []; } catch (e) { return []; } };
const saveDB = (data) => { try { fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2)); return true; } catch (e) { return false; } };

const loadTasks = () => { try { const p = getTasksPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : []; } catch (e) { return []; } };
const saveTasks = (data) => { try { fs.writeFileSync(getTasksPath(), JSON.stringify(data, null, 2)); } catch (e) {} };

const loadExternal = () => { try { const p = getExtPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : []; } catch (e) { return []; } };
const saveExternal = (data) => { try { fs.writeFileSync(getExtPath(), JSON.stringify(data, null, 2)); } catch (e) {} };

const loadHistory = () => { try { const p = getHistoryPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : []; } catch (e) { return []; } };
const saveHistory = (data) => { try { fs.writeFileSync(getHistoryPath(), JSON.stringify(data, null, 2)); } catch (e) {} };

const loadSettings = () => { try { const p = getSettingsPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {}; } catch (e) { return {}; } };
const saveSettings = (data) => { try { fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2)); } catch (e) {} };

const loadStock = () => { try { const p = getStockPath(); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : []; } catch (e) { return []; } };
const saveStock = (data) => { try { fs.writeFileSync(getStockPath(), JSON.stringify(data, null, 2)); } catch (e) {} };

init();

module.exports = {
    loadDB, saveDB,
    loadTasks, saveTasks,
    loadExternal, saveExternal,
    loadHistory, saveHistory,
    loadSettings, saveSettings,
    loadStock, saveStock,
    getDbPath
};