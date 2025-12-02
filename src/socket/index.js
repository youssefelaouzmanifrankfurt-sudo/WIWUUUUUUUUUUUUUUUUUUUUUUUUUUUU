// src/socket/index.js
const chatHandler = require('./chatHandler');
const taskHandler = require('./taskHandler');
// const dbHandler = require('./dbHandler'); // Nicht mehr benötigt
const trackingHandler = require('./trackingHandler');
const settingsHandler = require('./settingsHandler');

// NEU: Der modulare External-Handler (Ordner laden)
const externalHandler = require('./external'); 

// Das Lager-System (Ordner laden)
const stockHandler = require('./stock'); 

const logger = require('../utils/logger');

// +++ FIX: Service importieren, damit wir auf die DB zugreifen können +++
const inventoryService = require('../services/inventoryService'); 

module.exports = (io) => {
    io.on('connection', (socket) => {
        // Alle Handler starten
        chatHandler(io, socket);
        taskHandler(io, socket);
        trackingHandler(io, socket);
        settingsHandler(io, socket);
        
        // Die neuen modularen Handler
        externalHandler(io, socket);
        stockHandler(io, socket);

        // +++ FIX: Datenbank Listener wiederhergestellt +++
        // Das fehlte und hat verhindert, dass die Liste geladen wird
        socket.on('get-db-products', () => {
            const data = inventoryService.getAll();
            socket.emit('update-db-list', data);
        });

        // Auch das Löschen muss hier behandelt werden, wenn kein dbHandler mehr da ist
        socket.on('delete-db-item', (id) => {
             inventoryService.delete(id);
             io.emit('update-db-list', inventoryService.getAll());
        });
        // +++++++++++++++++++++++++++++++++++++++++++++++++

        // Globale Events
        socket.on('refresh-stock-request', () => {
            io.emit('force-reload-stock');
        });

        socket.on('start-scraper', (d) => logger.log('info', `Bot Start: ${d.term}`));
        socket.on('stop-scraper', () => logger.log('warning', 'Bot Stop'));
    });
};