const { parseDetailInBrowser } = require('./parsers');

/**
 * Ein Worker, der eine Queue von Anzeigen abarbeitet.
 * @param {object} browser - Die Browser Instanz
 * @param {Array} queue - Die Liste der zu scannenden Anzeigen
 * @param {Function} onProgress - Callback für Fortschritt
 */
async function startWorker(browser, queue, onProgress) {
    const page = await browser.newPage();
    
    // Optional: Bilder blockieren für mehr Speed (kannst du auskommentieren wenn du willst)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    while (queue.length > 0) {
        const ad = queue.shift(); // Nimm nächsten Job
        if (!ad) break;

        try {
            await page.goto(ad.url, { waitUntil: 'domcontentloaded' });
            
            // Hier nutzen wir die ausgelagerte Parser-Funktion
            const date = await page.evaluate(parseDetailInBrowser);
            ad.uploadDate = date;
            
            if (onProgress) onProgress(); // Fortschritt melden

        } catch (e) {
            ad.uploadDate = 'Unbekannt';
        }
        
        // Kurze Pause um nicht geblockt zu werden
        await new Promise(r => setTimeout(r, 500));
    }

    await page.close();
}

module.exports = { startWorker };