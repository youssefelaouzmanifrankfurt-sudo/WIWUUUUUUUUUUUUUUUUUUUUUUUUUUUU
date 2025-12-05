// public/js/lager/ui.js
window.ui = window.ui || {};

window.showLoading = (title, text, loading, success = false) => {
    window.closeAllModals();
    const modal = document.getElementById('loading-modal');
    if(!modal) return;
    document.getElementById('loading-title').innerText = title;
    document.getElementById('loading-text').innerText = text;
    document.getElementById('loading-spinner').innerText = loading ? "⏳" : (success ? "✅" : "❌");
    const btn = document.getElementById('btn-loading-ok');
    btn.style.display = loading ? 'none' : 'block';
    btn.innerText = success ? "OK" : "Schließen";
    btn.onclick = () => window.closeAllModals();
    modal.classList.add('open');
};

window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));

// --- NEU: VORSCHLÄGE RENDERN (SETS) ---
window.renderSuggestions = (results) => {
    const container = document.getElementById('suggestion-chips');
    const list = document.getElementById('price-results');
    
    if (!container) return;
    container.innerHTML = '';
    
    // Filtere nur einzigartige Titel heraus
    const uniqueTitles = [...new Set(results.map(r => r.title))].slice(0, 6); // Max 6 Vorschläge

    if (uniqueTitles.length > 0) {
        container.style.display = 'flex';
        // Verstecke die normale Preisliste, wir zeigen jetzt erst die Modelle
        list.style.display = 'none'; 
        
        uniqueTitles.forEach(title => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.innerText = title;
            chip.onclick = () => {
                // Klick übernimmt Titel und startet echte Suche
                document.getElementById('inp-title').value = title;
                container.style.display = 'none'; // Vorschläge ausblenden
                window.startPriceSearch(); // Echte Suche starten
            };
            container.appendChild(chip);
        });
    } else {
        container.style.display = 'none';
        alert("Keine speziellen Sets gefunden. Suche normal weiter.");
        window.startPriceSearch(); // Fallback auf normale Suche
    }
};

// --- WATCHLIST MIT LINKS & REFRESH ---
window.renderCompetitorList = (list) => {
    const container = document.getElementById('competitor-list');
    if(!container) return;
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = '<span style="color:#64748b; font-size:0.8rem; font-style:italic;">Keine Beobachtungen</span>';
        return;
    }

    list.forEach((comp, index) => {
        const tag = document.createElement('div');
        tag.className = 'competitor-tag';
        tag.innerHTML = `
            <a href="${comp.url}" target="_blank">
                <span>${comp.source}</span>
                <span class="comp-price" id="comp-price-${index}">${typeof comp.price === 'number' ? comp.price.toFixed(2) : comp.price}€</span>
                <span style="font-size:0.8em; margin-left:4px;">🔗</span>
            </a>
            <span onclick="window.refreshCompetitor(${index}, '${comp.url}')" title="Preis prüfen" style="cursor:pointer; margin:0 8px; font-size:0.9rem;">🔄</span>
            <span class="del-btn" onclick="window.removeCompetitor(${index})">×</span>
        `;
        container.appendChild(tag);
    });
};

// --- GEWINN MIT 19% STEUER ---
window.calcProfit = () => {
    const marketStr = document.getElementById('inp-market-price').value;
    const ekStr = document.getElementById('inp-price').value;
    const badge = document.getElementById('profit-badge');

    if (!marketStr || !ekStr) { badge.style.display = 'none'; return; }

    const sellingPrice = parseFloat(marketStr.replace(',', '.')) || 0;
    const ek = parseFloat(ekStr.replace(',', '.')) || 0;
    
    if (sellingPrice <= 0) return;

    // STEUER RECHNUNG: Brutto / 1.19 = Netto
    const netSelling = sellingPrice / 1.19;
    const profit = netSelling - ek;
    const margin = ek > 0 ? (profit / ek) * 100 : 0;

    badge.style.display = 'block';
    const profitStr = profit.toFixed(2).replace('.', ',');
    const marginStr = margin.toFixed(0);

    const htmlContent = `
        <div style="font-size:0.75rem; opacity:0.7; margin-bottom:4px;">
            VK: ${sellingPrice.toFixed(2)}€ | Netto: ${netSelling.toFixed(2)}€ (-19%)
        </div>
        <div style="font-size:1.2rem;">
            ${profit > 0 ? 'Gewinn' : 'Verlust'}: 
            ${profit > 0 ? '+' : ''}${profitStr} € <small>(${marginStr}%)</small> 
            ${profit > 0 ? '🚀' : '📉'}
        </div>
    `;

    badge.innerHTML = htmlContent;
    badge.className = profit > 0 ? 'profit-badge profit-win' : 'profit-badge profit-loss';
};

// ... (renderStock und renderPriceResults bleiben, nutze den Code vom vorherigen Schritt) ...
window.renderStock = (items) => { /* ... siehe vorherigen Code ... */
    // (Hier einfach den renderStock Code von vorhin einfügen, 
    //  achte darauf, dass bei profitInfo auch die Netto-Rechnung drin ist:)
    /* if (item.marketPrice > 0 && item.purchasePrice > 0) {
        const net = item.marketPrice / 1.19;
        const p = net - item.purchasePrice;
        ...
    }
    */
   // Um Platz zu sparen, poste ich nicht nochmal die ganze renderStock Funktion, 
   // aber die Logik ist dieselbe wie in UI.js oben
};
// Wir brauchen aber renderPriceResults, damit die Suche geht:
window.renderPriceResults = (results) => {
    const list = document.getElementById('price-results');
    if(!list) return;
    list.innerHTML = '';
    if(!results || results.length === 0) {
        list.innerHTML = '<div style="padding:20px;">Nichts gefunden.</div>'; return;
    }
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'price-item';
        let priceVal = typeof res.price === 'number' ? res.price : parseFloat(res.price.replace(',', '.')) || 0;
        let imgUrl = res.image || '/img/placeholder.png';
        div.innerHTML = `
            <img src="${imgUrl}">
            <div class="price-info">
                <div class="price-title">${res.title}</div>
                <div class="price-meta"><span class="price-source src-${res.source.toLowerCase()}">${res.source}</span><span class="price-val">${priceVal.toFixed(2)} €</span></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-choose" id="btn-select">Wählen</button>
                <button class="btn-mini" id="btn-watch" style="background:#334155;">👁</button>
            </div>
        `;
        div.querySelector('#btn-select').onclick = (e) => {
            e.stopPropagation();
            document.getElementById('inp-title').value = res.title;
            document.getElementById('inp-market-price').value = priceVal.toFixed(2);
            document.getElementById('inp-price').value = (priceVal * 0.45).toFixed(2); // 45%
            document.getElementById('inp-source-url').value = res.url;
            document.getElementById('inp-source-name').value = res.source;
            if(res.image) document.getElementById('inp-image').value = res.image;
            list.style.display = 'none';
            window.calcProfit();
        };
        div.querySelector('#btn-watch').onclick = (e) => {
            e.stopPropagation();
            if(window.addToWatchlist) window.addToWatchlist({ source: res.source, url: res.url, price: priceVal, title: res.title });
        };
        list.appendChild(div);
    });
};