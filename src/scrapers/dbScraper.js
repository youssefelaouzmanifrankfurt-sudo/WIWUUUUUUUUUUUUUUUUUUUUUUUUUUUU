// src/scrapers/dbScraper.js
const { getDbPage } = require('./chat/connection'); 
const logger = require('../utils/logger');
const { parseListInBrowser, parseDetailInBrowser } = require('./db/parsers');

// ⚡ PERFORMANCE EINSTELLUNGEN
const CONCURRENT_TABS = 5;       // 5 Tabs gleichzeitig
const PAGE_TIMEOUT = 30000;      // ERHÖHT: 30sek Timeout (statt 15s)
const MIN_DELAY = 150;           // Leicht erhöht für Stabilität

async function forceVisibility(page) {
    try {
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
            Object.defineProperty(document, 'hidden', { value: false, writable: true });
            window.dispatchEvent(new Event('visibilitychange'));
        });
    } catch(e) {}
}

async function scrapeMyAds(existingAds = [], progressCallback) {
    const mainPage = await getDbPage();
    
    // SAFETY 1: Wenn Browser/Seite nicht da ist -> ABBRUCH mit null
    if (!mainPage) {
        logger.log('error', '❌ Scan abgebrochen: Konnte Browser-Seite nicht öffnen.');
        return null;
    }

    logger.log('info', `🚀 Turbo-Scan gestartet (${CONCURRENT_TABS} Worker, Auto-Retry aktiv)...`);
    
    try {
        if (!mainPage.url().includes('m-meine-anzeigen')) {
            await mainPage.goto('https://www.kleinanzeigen.de/m-meine-anzeigen.html', { waitUntil: 'domcontentloaded' });
        } else {
            await mainPage.reload({ waitUntil: 'domcontentloaded' });
        }
        await forceVisibility(mainPage);
        await new Promise(r => setTimeout(r, 1500));

        // SAFETY 2: Sind wir überhaupt eingeloggt?
        const content = await mainPage.content();
        if (content.includes('Einloggen') || content.includes('Registrieren')) {
            logger.log('error', '❌ Scan abgebrochen: Nicht eingeloggt! Bitte im Browser anmelden.');
            return null;
        }

    } catch (e) {
        logger.log('error', 'Start-Fehler: ' + e.message);
        return null;
    }

    let finalAdsList = []; 
    let pageNum = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        logger.log('info', `📄 Scanne Liste Seite ${pageNum}...`);
        await forceVisibility(mainPage);

        // A) Liste Scrapen
        let liveAds = [];
        try {
            liveAds = await mainPage.evaluate(parseListInBrowser);
        } catch(e) {
            logger.log('error', `Fehler beim Lesen von Seite ${pageNum}: ${e.message}`);
            // Versuche Reload und Retry
            await mainPage.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 2000));
            liveAds = await mainPage.evaluate(parseListInBrowser);
        }

        // B) Daten Mergen
        const mergedAds = liveAds.map(liveAd => {
            const dbEntry = existingAds.find(dbAd => dbAd.id === liveAd.id);
            if (dbEntry) {
                // Übernehme vorhandene Deep-Data
                if (dbEntry.description) liveAd.description = dbEntry.description;
                if (dbEntry.images && dbEntry.images.length > 1) liveAd.images = dbEntry.images;
                if (dbEntry.uploadDate) liveAd.uploadDate = dbEntry.uploadDate;
                if (dbEntry.features) liveAd.features = dbEntry.features;
                if (dbEntry.cleanTitle) liveAd.title = dbEntry.cleanTitle;
                // Status übernehmen
                if (dbEntry.status === 'DELETED') liveAd.status = 'DELETED'; 
            }
            return liveAd;
        });

        // C) QUEUE: Was muss tief gescannt werden?
        const queue = mergedAds.filter(ad => {
            // Nur scannen, wenn wir es nicht haben UND die Anzeige eine URL hat
            const missingData = (!ad.description || ad.description.length < 10 || !ad.images || ad.images.length < 2);
            return missingData && ad.url; 
        });

        if (queue.length > 0) {
            logger.log('info', `⚡ Deep-Scan: ${queue.length} Anzeigen auf dieser Seite.`);
            
            const browser = mainPage.browser();
            
            // WORKER FUNKTION
            const createWorker = async (workerId) => {
                let page = null;
                try {
                    page = await browser.newPage();
                    
                    // 🔥 AGGRESSIVER BLOCKER: Alles blockieren außer HTML
                    await page.setRequestInterception(true);
                    page.on('request', r => {
                        const type = r.resourceType();
                        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type)) r.abort();
                        else r.continue();
                    });

                    while (queue.length > 0) {
                        const targetAd = queue.shift();
                        if (!targetAd) break; 

                        // RETRY LOOP (NEU)
                        let attempts = 0;
                        const maxAttempts = 2; // 1 Normal + 1 Retry
                        let success = false;

                        while (attempts < maxAttempts && !success) {
                            attempts++;
                            try {
                                // Timeout setzen, damit er nicht ewig hängt
                                await page.goto(targetAd.url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
                                
                                // Schnell parsen
                                const details = await page.evaluate(parseDetailInBrowser);
                                
                                if (details) {
                                    if (details.description) targetAd.description = details.description;
                                    if (details.images && details.images.length > 0) targetAd.images = details.images;
                                    if (details.cleanTitle && details.cleanTitle.length > 3) targetAd.title = details.cleanTitle;
                                    if (details.uploadDate) targetAd.uploadDate = details.uploadDate;
                                }
                                
                                success = true; // Markieren als erfolgreich, um Loop zu verlassen

                            } catch (e) {
                                // Fehlerbehandlung
                                const isTimeout = e.message.includes('timeout') || e.message.includes('callFunctionOn');
                                
                                if (attempts < maxAttempts) {
                                    logger.log('warn', `   [W${workerId}] ⚠️ Timeout bei ${targetAd.id}. Starte 2. Versuch...`);
                                    await new Promise(r => setTimeout(r, 2000)); // Kurze Pause vor Retry
                                } else {
                                    // Wenn auch der letzte Versuch fehlschlägt
                                    if(isTimeout) {
                                        logger.log('warn', `   [W${workerId}] ❌ Timeout bei ${targetAd.id} nach ${attempts} Versuchen - Überspringe.`);
                                    } else {
                                        logger.log('warn', `   [W${workerId}] ❌ Fehler bei ${targetAd.id}: ${e.message}`);
                                    }
                                }
                                
                                // Seite resetten für sauberen nächsten Versuch
                                try { await page.goto('about:blank'); } catch(err){}
                            }
                        }

                        // Nur sehr kurze Pause nach Erfolg
                        if(success) await new Promise(r => setTimeout(r, MIN_DELAY));
                    }
                } catch(err) {
                    logger.log('error', `Worker ${workerId} abgestürzt: ${err.message}`);
                } finally {
                    if(page) await page.close().catch(()=>{});
                }
            };

            // Worker Pool starten
            const activeWorkers = [];
            const numWorkers = Math.min(CONCURRENT_TABS, queue.length);
            for(let i=0; i < numWorkers; i++) activeWorkers.push(createWorker(i + 1));
            
            await Promise.all(activeWorkers);
            logger.log('success', `   ✅ Deep-Scan Seite ${pageNum} fertig.`);
        }

        finalAdsList = finalAdsList.concat(mergedAds);

        // E) Pagination
        try {
            const nextBtn = await mainPage.$('button[aria-label="Nächste"]');
            if (nextBtn && !(await mainPage.evaluate(el => el.disabled, nextBtn))) {
                await mainPage.evaluate(el => el.scrollIntoView(), nextBtn);
                await Promise.all([
                    mainPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{}),
                    nextBtn.click()
                ]);
                pageNum++;
            } else { 
                hasNextPage = false; 
            }
        } catch(e) {
            logger.log('warn', 'Pagination Fehler (wahrscheinlich letzte Seite): ' + e.message);
            hasNextPage = false;
        }
        
        if(progressCallback) progressCallback(finalAdsList.length, "unbekannt");
    }

    // SAFETY 3: Haben wir wirklich 0 Anzeigen oder ist was faul?
    if (finalAdsList.length === 0 && pageNum === 1) {
         try {
             const noAdsText = await mainPage.evaluate(() => document.body.innerText.includes("Keine Anzeigen"));
             if (!noAdsText) {
                 logger.log('warning', '⚠️ Scan ergab 0 Treffer, aber "Keine Anzeigen" Text fehlt. Sicherheitshalber Abbruch.');
                 return null;
             }
         } catch(e) {}
    }

    logger.log('success', `✅ Fertig! ${finalAdsList.length} Anzeigen gescannt.`);
    try { await mainPage.goto('https://www.kleinanzeigen.de/m-meine-anzeigen.html'); } catch(e){}
    return finalAdsList;
}

module.exports = { scrapeMyAds };