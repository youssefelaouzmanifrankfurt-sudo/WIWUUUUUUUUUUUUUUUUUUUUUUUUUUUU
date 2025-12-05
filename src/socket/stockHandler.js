// src/socket/stockHandler.js
const stockService = require('../services/stockService');
const inventoryService = require('../services/inventoryService');
const priceService = require('../services/priceService');
const matchService = require('../services/matchService');
const importService = require('../services/importService');

// Helper: Bestes Bild finden
function getBestImage(adItem) {
    if (!adItem) return null;
    if (Array.isArray(adItem.images) && adItem.images.length > 0) return adItem.images[0];
    if (adItem.img && adItem.img.length > 5) return adItem.img;
    if (adItem.image && adItem.image.length > 5) return adItem.image;
    return null; 
}

module.exports = (io, socket) => {
    
    // 1. LAGER ABFRUFEN
    socket.on('get-stock', () => {
        const stock = stockService.getAll();
        const inventory = inventoryService.getAll();
        const inventoryMap = new Map(inventory.map(ad => [ad.id, ad]));

        const enrichedStock = stock.map(item => {
            let adStatus = 'OFFLINE';
            let displayImage = item.image;
            let linkedAd = null;

            // Verknüpfung prüfen
            if (item.linkedAdId && inventoryMap.has(item.linkedAdId)) {
                linkedAd = inventoryMap.get(item.linkedAdId);
            } else if (item.title) {
                // Fallback: Namens-Match
                linkedAd = inventory.find(ad => ad.title && ad.title.toLowerCase() === item.title.toLowerCase());
            }

            if (linkedAd) {
                adStatus = linkedAd.status || 'ACTIVE';
                if (!displayImage) displayImage = getBestImage(linkedAd);
            }

            // Ampel Status
            let trafficStatus = 'grey'; 
            const qty = parseInt(item.quantity) || 0;
            const isOnline = (adStatus === 'ACTIVE');

            if (qty > 0 && isOnline) trafficStatus = 'green';
            else if (qty > 0 && !isOnline) trafficStatus = 'yellow';
            else if (qty <= 0 && isOnline) trafficStatus = 'red';

            return { 
                ...item, 
                onlineStatus: adStatus, 
                isLinked: !!item.linkedAdId, 
                image: displayImage, 
                trafficStatus 
            };
        });
        socket.emit('update-stock', enrichedStock);
    });

    // 2. PREIS CHECK
    socket.on('search-price-sources', async (query) => {
        console.log(`[Stock] Suche Preise für: ${query}`);
        try {
            const results = await priceService.searchMarketPrices(query);
            socket.emit('price-search-results', results);
        } catch (e) {
            console.error(e);
            socket.emit('price-search-results', []);
        }
    });

    // 3. MATCH SUCHE
    socket.on('request-db-match', (stockId) => {
        const item = stockService.getAll().find(i => i.id === stockId);
        if (!item) return;

        const candidates = matchService.findMatchesForStockItem(item.title);
        socket.emit('db-match-result', {
            found: true, 
            stockId: stockId,
            candidates: candidates 
        });
    });

    // 4. SMART IMPORT
    socket.on('auto-create-ad', async (stockId) => {
        const item = stockService.getAll().find(i => i.id === stockId);
        if (!item) return;

        socket.emit('export-progress', "Starte Import...");
        try {
            await importService.createImportFromStock(item);
            io.emit('reload-imported'); 
            socket.emit('export-success', "Erfolgreich in Ablage importiert.");
        } catch(e) {
            socket.emit('export-error', e.message);
        }
    });

    // 5. CRUD AKTIONEN
    socket.on('create-new-stock', (data) => {
        console.log("[Stock] Neu:", data.title);
        const sku = data.sku || ("LAGER-" + Math.floor(Math.random() * 10000));
        stockService.createNewItem(data.title, { 
            ...data,
            sku: sku,
            marketPrice: data.marketPrice || 0,
            lastPriceCheck: new Date().toLocaleDateString()
        });
        io.emit('force-reload-stock');
    });

    socket.on('update-stock-details', (d) => { 
        stockService.updateDetails(d.id, d); 
        io.emit('force-reload-stock'); 
    });

    // --- HIER WAR DAS PROBLEM BEIM LÖSCHEN ---
    socket.on('delete-stock-item', (id) => {
        console.log(`[Stock] Lösche Item ID: ${id}`);
        const item = stockService.getAll().find(i => i.id === id);
        
        // Falls verknüpft, Inventar updaten
        if (item && item.linkedAdId) {
            console.log(`[Stock] Löse Verknüpfung zu Anzeige ${item.linkedAdId}`);
            inventoryService.removeFromStock(item.linkedAdId);
            io.emit('update-db-list', inventoryService.getAll());
        }

        // Löschen durchführen
        const success = stockService.delete(id);
        if(success) {
            console.log("[Stock] Erfolgreich gelöscht.");
            io.emit('force-reload-stock'); // Client aktualisieren
        } else {
            console.warn("[Stock] Löschen fehlgeschlagen (ID nicht gefunden).");
        }
    });

    socket.on('update-stock-qty', (data) => {
        const updatedStock = stockService.updateQuantity(data.id, data.delta);
        const item = updatedStock.find(i => i.id === data.id);
        
        // Lagerstatus synchronisieren
        if (item && item.linkedAdId) {
            if (item.quantity <= 0) inventoryService.removeFromStock(item.linkedAdId);
            else inventoryService.markAsInStock(item.linkedAdId);
            io.emit('update-db-list', inventoryService.getAll());
        }
        io.emit('force-reload-stock');
    });

    // 6. VERBINDEN & TRENNEN
    socket.on('confirm-link', (data) => {
        stockService.linkToAd(data.stockId, data.adId, data.adImage);
        inventoryService.markAsInStock(data.adId);
        io.emit('force-reload-stock');
        io.emit('update-db-list', inventoryService.getAll());
    });

    socket.on('unlink-stock-item', (stockId) => {
        const item = stockService.getAll().find(i => i.id === stockId);
        if (item && item.linkedAdId) {
            inventoryService.removeFromStock(item.linkedAdId);
            item.linkedAdId = null;
            stockService.updateDetails(item.id, item);
            io.emit('update-db-list', inventoryService.getAll());
            io.emit('force-reload-stock');
        }
    });

    // 7. SCAN
    socket.on('check-scan', (query) => {
        console.log("[Stock] Scan Check:", query);
        const stockItem = stockService.findInStock(query);
        if (stockItem) {
            const updatedList = stockService.incrementQuantity(stockItem.id);
            // Sync Logic falls Menge 0 -> 1 springt
            const updatedItem = updatedList.find(i => i.id === stockItem.id);
            if(updatedItem && updatedItem.quantity === 1 && updatedItem.linkedAdId) {
                inventoryService.markAsInStock(updatedItem.linkedAdId);
                io.emit('update-db-list', inventoryService.getAll());
            }
            
            io.emit('force-reload-stock');
            socket.emit('scan-result', { type: 'FOUND_STOCK', item: stockItem });
        } else {
            socket.emit('scan-result', { type: 'NOT_FOUND', scannedName: query });
        }
    });
};