// src/socket/stock/reader.js
const stockService = require('../../services/stockService');
const inventoryService = require('../../services/inventoryService');
const priceService = require('../../services/priceService');
const matchService = require('../../services/matchService');
const { getBestImage } = require('./helpers');

module.exports = (io, socket) => {
    
    // Lagerbestand abrufen
    socket.on('get-stock', () => {
        const stock = stockService.getAll();
        const inventory = inventoryService.getAll();
        const inventoryMap = new Map(inventory.map(ad => [ad.id, ad]));

        const enrichedStock = stock.map(item => {
            let adStatus = 'OFFLINE';
            let displayImage = item.image;
            let linkedAd = null;

            if (item.linkedAdId && inventoryMap.has(item.linkedAdId)) {
                linkedAd = inventoryMap.get(item.linkedAdId);
            } else if (item.title) {
                linkedAd = inventory.find(ad => ad.title && ad.title.toLowerCase() === item.title.toLowerCase());
            }

            if (linkedAd) {
                adStatus = linkedAd.status || 'ACTIVE';
                if (!displayImage) displayImage = getBestImage(linkedAd);
            }

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

    // Preissuche
    socket.on('search-price-sources', async (query) => {
        try {
            const results = await priceService.searchMarketPrices(query);
            socket.emit('price-search-results', results);
        } catch (e) {
            socket.emit('price-search-results', []);
        }
    });

    // DB Match Suche (Automatisch)
    socket.on('request-db-match', (stockId) => {
        const item = stockService.getAll().find(i => i.id === stockId);
        if (!item) return;
        const candidates = matchService.findMatchesForStockItem(item.title);
        socket.emit('db-match-result', { found: true, stockId, candidates });
    });

    // NEU: Manuelle DB Suche für Verknüpfung
    socket.on('search-db-for-link', (query) => {
        const allAds = inventoryService.getAll();
        const term = query.toLowerCase();
        
        // Filtern nach Titel oder ID
        const results = allAds.filter(ad => 
            (ad.title && ad.title.toLowerCase().includes(term)) || 
            (ad.id && ad.id.includes(term))
        ).slice(0, 20); // Limitieren auf 20

        // Formatieren für Frontend
        const candidates = results.map(ad => ({
            id: ad.id,
            title: ad.title,
            price: ad.price,
            status: ad.status || (ad.active ? 'ACTIVE' : 'INACTIVE'),
            image: getBestImage(ad),
            score: null // Kein Score, da manuell gesucht
        }));

        socket.emit('db-match-search-results', candidates);
    });
};