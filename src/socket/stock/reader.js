// src/socket/stock/reader.js
const stockService = require('../../services/stockService');
const inventoryService = require('../../services/inventoryService');
const { compareStrings } = require('../../utils/similarity');
const logger = require('../../utils/logger');
const { getBestImage, parsePrice, calculateTrafficStatus } = require('./helpers');

// --- HIER HATTEN DIE SCRAPER GEFEHLT ---
const ottoScraper = require('../../scrapers/ottoScraper');
const idealoScraper = require('../../scrapers/idealoScraper');
const baurScraper = require('../../scrapers/baurScraper');     
const amazonScraper = require('../../scrapers/amazonScraper'); 

module.exports = (io, socket) => {
    
    // 1. LAGER LISTE LADEN
    socket.on('get-stock', () => {
        const stock = stockService.getAll();
        const inventory = inventoryService.getAll();
        const inventoryMap = new Map();
        inventory.forEach(ad => inventoryMap.set(ad.id, ad));

        const enrichedStock = stock.map(item => {
            let adStatus = 'OFFLINE';
            let displayImage = item.image;
            let linkedAd = null;

            if (item.linkedAdId && inventoryMap.has(item.linkedAdId)) {
                linkedAd = inventoryMap.get(item.linkedAdId);
            } else if (item.title) {
                const match = inventory.find(ad => ad.title.toLowerCase() === item.title.toLowerCase());
                if (match && !item.linkedAdId) linkedAd = match;
            }

            if (linkedAd) {
                adStatus = linkedAd.status || 'ACTIVE';
                if (!displayImage) displayImage = getBestImage(linkedAd);
            }

            const trafficStatus = calculateTrafficStatus(parseInt(item.quantity)||0, adStatus);

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

    // 2. PREIS CHECK (ALLE QUELLEN)
    socket.on('search-price-sources', async (query) => {
        if (!query || query.length < 3) return;
        logger.log('info', `🔎 Preis-Check: "${query}"`);

        // Alle Scraper parallel starten
        const pOtto = ottoScraper.searchOtto(query).catch(() => []);
        const pIdealo = idealoScraper.searchIdealo(query).catch(() => []);
        const pBaur = baurScraper.searchBaur(query).catch(() => []);     
        const pAmazon = amazonScraper.searchAmazon(query).catch(() => []); 
        
        const [rOtto, rIdealo, rBaur, rAmazon] = await Promise.all([pOtto, pIdealo, pBaur, pAmazon]);
        
        let allResults = [];
        const formatRes = (list, source) => list.slice(0, 3).map(item => ({
            title: item.title,
            price: parsePrice(item.price),
            image: item.img || item.image,
            url: item.url,
            source: source
        }));

        if (rOtto) allResults.push(...formatRes(rOtto, 'Otto'));
        if (rBaur) allResults.push(...formatRes(rBaur, 'Baur')); 
        if (rAmazon) allResults.push(...formatRes(rAmazon, 'Amazon'));
        if (rIdealo) allResults.push(...formatRes(rIdealo, 'Idealo'));

        socket.emit('price-search-results', allResults);
    });

    // 3. MATCH SUCHE
    socket.on('request-db-match', (stockId) => {
        const stockItems = stockService.getAll();
        const item = stockItems.find(i => i.id === stockId);
        if (!item) return;

        const inventory = inventoryService.getAll();
        const candidates = inventory.map(ad => {
            const score = compareStrings(item.title, ad.title);
            return {
                id: ad.id,
                title: ad.title,
                price: ad.price,
                image: getBestImage(ad),
                status: ad.status,
                score: score
            };
        });

        const top5 = candidates.filter(c => c.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 5);

        socket.emit('db-match-result', {
            found: true, 
            stockId: stockId,
            candidates: top5 
        });
    });
};