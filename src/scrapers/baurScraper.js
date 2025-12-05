// src/scrapers/baurScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

async function searchBaur(query) {
    const browser = await getBrowser();
    if (!browser) return [];
    
    let page = null;
    try {
        page = await browser.newPage();
        // Desktop Viewport ist wichtig für Baur
        await page.setViewport({ width: 1366, height: 768 });
        
        // Timeout erhöhen, Baur ist manchmal langsam
        await page.goto(`https://www.baur.de/suche?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const results = await page.evaluate(() => {
            // Selektoren für Baur Suchergebnisse
            const items = document.querySelectorAll('a.product-tile, div.product-tile');
            const data = [];
            
            items.forEach(item => {
                // Titel finden
                const titleEl = item.querySelector('.product-tile__name') || item.querySelector('[data-test="product-title"]');
                // Preis finden (Regular oder Reduziert)
                const priceEl = item.querySelector('.product-price__regular') || item.querySelector('.product-price__reduced') || item.querySelector('[data-test="product-price"]');
                // Bild finden
                const imgEl = item.querySelector('img.product-tile__image') || item.querySelector('img');
                // Link finden (falls das Item selbst kein Link ist)
                const linkEl = item.tagName === 'A' ? item : item.querySelector('a');
                
                if (titleEl && priceEl && linkEl) {
                    let price = priceEl.innerText.replace('€', '').trim();
                    // Bild-Quelle extrahieren (oft lazy loaded in data-src)
                    let imgSrc = imgEl ? (imgEl.dataset.src || imgEl.src) : '';
                    
                    data.push({
                        title: titleEl.innerText.trim(),
                        price: price,
                        img: imgSrc,
                        url: linkEl.href,
                        source: 'Baur'
                    });
                }
            });
            return data;
        });
        
        return results.slice(0, 25); // Top 25 Ergebnisse
    } catch(e) {
        logger.log('error', '[Baur Search] ' + e.message);
        return [];
    } finally {
        if(page) await page.close().catch(()=>{});
    }
}

// NEU: Funktion für den Preis-Check in der Watchlist
async function scrapeBaurPrice(url) {
    const browser = await getBrowser();
    if (!browser) return 0;
    
    let page = null;
    try {
        page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        const price = await page.evaluate(() => {
            // Versuche verschiedene Preis-Selektoren
            const el = document.querySelector('.product-price__regular') || 
                       document.querySelector('.product-price__reduced') || 
                       document.querySelector('[data-test="product-price"]');
                       
            return el ? el.innerText.trim() : null;
        });
        
        return price;
    } catch(e) {
        logger.log('error', '[Baur Price] ' + e.message);
        return 0;
    } finally {
        if(page) await page.close().catch(()=>{});
    }
}

module.exports = { searchBaur, scrapeBaurPrice };