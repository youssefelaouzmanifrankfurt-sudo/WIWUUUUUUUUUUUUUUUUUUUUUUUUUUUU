// src/socket/stockHandler.js
const stockService = require('../services/stockService');
const inventoryService = require('../services/inventoryService');

const priceService = require('../services/priceService');     // NEU
const matchService = require('../services/matchService');     // NEU
const importService = require('../services/importService');   // NEU

// Helper: Bestes Bild finden (Für die Listen-Ansicht hier noch benötigt)
function getBestImage(adItem) {
    if (!adItem) return null;
    if (Array.isArray(adItem.images) && adItem.images.length > 0) return adItem.images[0];
    if (adItem.img && adItem.img.length > 5) return adItem.img;
    if (adItem.image && adItem.image.length > 5) return adItem.image;
    return null; 
}

module.exports = (io, socket) => {
    
    // 1. LAGER ABFRUFEN (Mit Ampel Logic)
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
                // Namens-Match (Fallback)
                linkedAd = inventory.find(ad => ad.title.toLowerCase() === item.title.toLowerCase());
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

    // 2. PREIS CHECK (Jetzt über Service)
    socket.on('search-price-sources', async (query) => {
        const results = await priceService.searchMarketPrices(query);
        socket.emit('price-search-results', results);
    });

    // 3. MATCH SUCHE (Jetzt über Service)
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

    // 4. SMART IMPORT (Jetzt über Service)
    socket.on('auto-create-ad', async (stockId) => {
        const item = stockService.getAll().find(i => i.id === stockId);
        if (!item) return;

        await importService.createImportFromStock(item);

        io.emit('reload-imported'); 
        socket.emit('export-success', "In die Ablage verschoben! Bitte dort prüfen & veröffentlichen.");
    });

    // 5. CRUD AKTIONEN (Bleibt schlank via stockService)
    socket.on('create-new-stock', (data) => {
        const sku = data.sku || ("SKU-" + Math.floor(Math.random() * 10000));
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

    socket.on('delete-stock-item', (id) => {
        const item = stockService.getAll().find(i => i.id === id);
        if (item && item.linkedAdId) {
            inventoryService.removeFromStock(item.linkedAdId);
            io.emit('update-db-list', inventoryService.getAll());
        }
        stockService.delete(id);
        io.emit('force-reload-stock');
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