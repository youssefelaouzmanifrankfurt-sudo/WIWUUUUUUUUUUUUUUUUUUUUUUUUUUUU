// src/services/importService.js
const storage = require('../utils/storage');
const ottoScraper = require('../scrapers/ottoScraper');
const logger = require('../utils/logger');

async function createImportFromStock(stockItem) {
    if (!stockItem) return null;

    logger.log('info', `🤖 Import-Service: Erstelle Import für "${stockItem.title}"`);

    let description = "Automatisch erstellt aus Lagerbestand.";
    let images = stockItem.image ? [stockItem.image] : [];
    
    // Live-Scrape von Otto versuchen, wenn URL da ist
    if (stockItem.sourceUrl && stockItem.sourceUrl.includes('otto.de')) {
        try {
            const details = await ottoScraper.scrapeOttoDetails(stockItem.sourceUrl);
            if (details) {
                if (details.description) description = details.description;
                if (details.images && details.images.length > 0) images = details.images;
            }
        } catch (e) {
            logger.log('error', "Fehler beim Auto-Scrape für Import: " + e.message);
        }
    }

    // Import-Objekt bauen
    const newImport = {
        id: "IMP-" + Date.now(),
        title: stockItem.title,
        description: description,
        price: stockItem.purchasePrice ? (parseFloat(stockItem.purchasePrice) * 2.2).toFixed(0) : "VB",
        images: images,
        source: "Lagerbestand (" + (stockItem.sourceName || 'Manuell') + ")",
        url: stockItem.sourceUrl || "",
        scannedAt: new Date().toLocaleDateString(),
        stockId: stockItem.id 
    };

    // Speichern
    const importedList = storage.loadExternal();
    importedList.push(newImport);
    storage.saveExternal(importedList);

    return newImport;
}

module.exports = {
    createImportFromStock
};