// src/socket/stock/writer.js
const stockService = require('../../services/stockService');
const inventoryService = require('../../services/inventoryService');
const storage = require('../../utils/storage');
const logger = require('../../utils/logger');
const { connectToBrowser } = require('../../scrapers/chat/connection');

// --- ALLE SCRAPER IMPORTE (JETZT VOLLSTÄNDIG) ---
const ottoScraper = require('../../scrapers/ottoScraper');
const baurScraper = require('../../scrapers/baurScraper');
const amazonScraper = require('../../scrapers/amazonScraper');
const idealoScraper = require('../../scrapers/idealoScraper'); // NEU
const expertScraper = require('../../scrapers/expertScraper'); // NEU

module.exports = (io, socket) => {

    // --- 1. SMART IMPORT (Der "Neu Inserieren" Prozess) ---
    socket.on('auto-create-ad', async (stockId) => {
        const stockItems = stockService.getAll();
        const item = stockItems.find(i => i.id === stockId);
        
        if (!item) return socket.emit('export-error', "Artikel nicht gefunden.");

        logger.log('info', `🤖 AUTO-IMPORT für: "${item.title}"`);
        socket.emit('export-progress', "Starte Scraper..."); 

        let description = "Automatisch erstellt aus Lagerbestand.";
        let images = item.image ? [item.image] : [];
        let techData = [];
        let price = "VB";
        
        if (item.purchasePrice) {
            price = (parseFloat(item.purchasePrice) * 2.2).toFixed(0);
        }

        // --- URL CHECK & SCRAPER START ---
        if (item.sourceUrl) {
            try {
                logger.log('info', `🌍 Scrape URL: ${item.sourceUrl}`);
                await connectToBrowser(); // Browser wecken

                let details = null;
                const url = item.sourceUrl;

                // 1. OTTO
                if (url.includes('otto.de')) {
                    details = await ottoScraper.scrapeOttoDetails(url);
                } 
                // 2. BAUR
                else if (url.includes('baur.de')) {
                    details = await baurScraper.scrapeBaurDetails(url);
                }
                // 3. AMAZON (inkl. amzn.to)
                else if (url.includes('amazon.de') || url.includes('amzn.to')) {
                    details = await amazonScraper.scrapeAmazonDetails(url);
                }
                // 4. EXPERT (NEU)
                else if (url.includes('expert.de')) {
                    details = await expertScraper.scrapeExpertDetails(url);
                }
                // 5. IDEALO (NEU - falls Scraper Details unterstützt)
                else if (url.includes('idealo.de')) {
                    // Idealo ist oft schwer zu scrapen für Details, aber wir versuchen es
                    if(idealoScraper.scrapeIdealoDetails) {
                        details = await idealoScraper.scrapeIdealoDetails(url);
                    }
                }

                if (details) {
                    logger.log('success', `✅ Scrape erfolgreich: ${details.title.substring(0,30)}...`);
                    
                    if (details.description && details.description.length > 10) description = details.description;
                    if (details.images && details.images.length > 0) images = details.images;
                    if (details.techData) techData = details.techData;
                    
                    // Energie-Label Logik ist in den Scrapern selbst (splice 1)
                } else {
                    logger.log('warning', "⚠️ URL erkannt, aber Scraper lieferte keine Details (oder Seite blockiert).");
                }

            } catch (e) {
                logger.log('error', "❌ Scrape Fehler: " + e.message);
                // Kein Abbruch! Wir erstellen trotzdem den Entwurf mit den Basisdaten.
            }
        } else {
            logger.log('info', "ℹ️ Keine URL im Lager-Item hinterlegt. Erstelle manuellen Entwurf.");
        }

        // --- IN ABLAGE SPEICHERN ---
        const newImport = {
            id: "IMP-" + Date.now(),
            title: item.title,
            description: description,
            price: price,
            images: images,
            techData: techData || [],
            source: "Lager: " + (item.sourceName || 'Manuell'),
            url: item.sourceUrl || "",
            scannedAt: new Date().toLocaleDateString(),
            stockId: item.id, 
            status: 'NEW'
        };

        try {
            const importedList = storage.loadExternal();
            importedList.push(newImport);
            storage.saveExternal(importedList);
            
            io.emit('reload-imported'); 
            socket.emit('export-success', "Erfolgreich in die Ablage verschoben! (Scraper Daten integriert)");
            
        } catch (err) {
            socket.emit('export-error', "Fehler beim Speichern in die Ablage.");
        }
    });

    // --- 2. CRUD (Lager Verwaltung - bleibt gleich) ---
    socket.on('create-new-stock', (data) => {
        const sku = data.sku || ("SKU-" + Math.floor(Math.random() * 10000));
        stockService.createNewItem(data.title, { 
            sku: sku, location: data.location, purchasePrice: data.purchasePrice, quantity: data.quantity,
            marketPrice: data.marketPrice || 0, sourceUrl: data.sourceUrl || "", sourceName: data.sourceName || "",
            lastPriceCheck: new Date().toLocaleDateString()
        });
        io.emit('force-reload-stock');
    });

    socket.on('update-stock-details', (d) => { stockService.updateDetails(d.id, d); io.emit('force-reload-stock'); });
    socket.on('delete-stock-item', (id) => { 
        const item = stockService.getAll().find(i => i.id === id);
        if (item && item.linkedAdId) {
            inventoryService.removeFromStock(item.linkedAdId);
            io.emit('update-db-list', inventoryService.getAll());
        }
        stockService.delete(id); io.emit('force-reload-stock'); 
    });
    socket.on('update-stock-qty', (data) => {
        const updatedStock = stockService.updateQuantity(data.id, data.delta);
        const item = updatedStock.find(i => i.id === data.id);
        if (item && item.linkedAdId) {
            if (item.quantity <= 0) inventoryService.removeFromStock(item.linkedAdId);
            else inventoryService.markAsInStock(item.linkedAdId);
            io.emit('update-db-list', inventoryService.getAll());
        }
        io.emit('force-reload-stock');
    });

    // --- 3. LINKING ---
    socket.on('confirm-link', (data) => {
        stockService.linkToAd(data.stockId, data.adId, data.adImage);
        inventoryService.markAsInStock(data.adId);
        io.emit('force-reload-stock');
        io.emit('update-db-list', inventoryService.getAll());
    });

    socket.on('unlink-stock-item', (stockId) => {
        const stockItems = stockService.getAll();
        const item = stockItems.find(i => i.id === stockId);
        if (item && item.linkedAdId) {
            inventoryService.removeFromStock(item.linkedAdId);
            item.linkedAdId = null;
            stockService.updateDetails(item.id, item);
            io.emit('update-db-list', inventoryService.getAll());
            io.emit('force-reload-stock');
        }
    });

    // --- 4. SCANNER ---
    socket.on('check-scan', (query) => {
        const stockItem = stockService.findInStock(query);
        if (stockItem) {
            const updatedList = stockService.incrementQuantity(stockItem.id);
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