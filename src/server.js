// src/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Services & Utils
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const socketManager = require('./socket/index');
const systemState = require('./utils/state'); // Unser neuer State
const { connectToBrowser } = require('./scrapers/chat/connection');
const chatMonitor = require('./scrapers/chat/monitor');

// Neue Module importieren
const viewRoutes = require('./routes/views');
const apiRoutes = require('./routes/api');
const startAutoScan = require('./jobs/scheduler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

logger.init(io);

const PORT = process.env.PORT || 3000;
const IS_MAIN_SERVER = (String(PORT) === '3000');

// Globale Variable initialisieren
global.adsDB = []; 

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Lade-Bildschirm Middleware
app.use((req, res, next) => {
    // Pfade die immer erlaubt sind (Assets, API, Boot-Check)
    if (req.path.startsWith('/public') || req.path.includes('boot') || req.path.startsWith('/api')) return next();
    
    // Wenn System bereit -> Weiter, sonst Lade-Seite
    if (systemState.isReady) next();
    else res.render('loading');
});

// --- ROUTEN ---
app.use('/', viewRoutes);   // Alle Seiten (Dashboard, Lager, etc.)
app.use('/api', apiRoutes); // Alle API Funktionen (Scan, QR, Browser)

// --- SOCKETS ---
socketManager(io);

// --- SYSTEM START ---
async function bootSystem() {
    // Ordner erstellen falls nötig
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

    if (IS_MAIN_SERVER) {
        const serverPath = 'C:\\weeeeeee_data';
        if (!fs.existsSync(serverPath)) {
            try { fs.mkdirSync(serverPath, { recursive: true }); } catch(e) {}
        }
    }
    
    // DB laden
    global.adsDB = storage.loadDB() || [];
    logger.log('success', `System bereit auf Port ${PORT}`);

    // Datei-Überwachung (Inventory Watcher)
    const dbPath = storage.getDbPath();
    if (dbPath && fs.existsSync(path.dirname(dbPath))) {
        let fsWait = false;
        fs.watch(path.dirname(dbPath), (event, filename) => {
            if (filename === 'inventory.json' && event === 'change') {
                if (fsWait) return;
                fsWait = true;
                setTimeout(() => fsWait = false, 500);
                const newData = storage.loadDB();
                if(newData) { global.adsDB = newData; io.emit('update-db-list', global.adsDB); }
            }
        });
    }

    // Browser starten
    try { await connectToBrowser(); } catch(e) {}
    
    // Chat Monitor starten
    chatMonitor.startChatMonitor(io);
    
    logger.log('info', '👀 Chat-Monitor aktiv (Hintergrund-Modus).');
    
    // System freigeben
    systemState.isReady = true;

    // Auto-Scan starten (nur auf Hauptserver)
    if (IS_MAIN_SERVER) startAutoScan(io);
}

// Helper: IP Adresse finden
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

// Server starten
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ SERVER: http://${getLocalIP()}:${PORT}`);
    bootSystem();
});