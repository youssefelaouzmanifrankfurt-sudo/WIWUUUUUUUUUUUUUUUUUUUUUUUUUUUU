// public/js/lager/ui.js

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

// --- RENDER WATCHLIST ---
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
            <span>${comp.source}</span>
            <span class="comp-price">${typeof comp.price === 'number' ? comp.price.toFixed(2) : comp.price}€</span>
            <span class="del-btn" onclick="window.removeCompetitor(${index})">×</span>
        `;
        container.appendChild(tag);
    });
};

// --- PROFIT CALC ---
window.calcProfit = () => {
    const marketStr = document.getElementById('inp-market-price').value;
    const ekStr = document.getElementById('inp-price').value;
    const badge = document.getElementById('profit-badge');

    if (!marketStr || !ekStr) {
        badge.style.display = 'none';
        return;
    }

    const market = parseFloat(marketStr.replace(',', '.')) || 0;
    const ek = parseFloat(ekStr.replace(',', '.')) || 0;
    
    if (ek <= 0) return;

    const profit = market - ek;
    const margin = (profit / ek) * 100;

    badge.style.display = 'block';
    
    const profitStr = profit.toFixed(2).replace('.', ',');
    const marginStr = margin.toFixed(0);

    if (profit > 0) {
        badge.className = 'profit-badge profit-win';
        badge.innerHTML = `Gewinn: +${profitStr} € <small>(${marginStr}%)</small> 🚀`;
    } else {
        badge.className = 'profit-badge profit-loss';
        badge.innerHTML = `Verlust: ${profitStr} € <small>(${marginStr}%)</small> 📉`;
    }
};

// --- RENDER STOCK LIST ---
window.renderStock = (items) => {
    const grid = document.getElementById('stock-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const priority = { 'red': 4, 'yellow': 3, 'green': 2, 'grey': 1 };
    items.sort((a,b) => priority[b.trafficStatus] - priority[a.trafficStatus]);
    
    const statEl = document.getElementById('stat-total');
    if(statEl) statEl.innerText = items.reduce((acc, i) => acc + (parseInt(i.quantity)||0), 0);

    items.forEach(item => {
        let trafficClass = 'light-grey';
        let statusMsg = 'Inaktiv';
        let actionBtn = '';

        if (item.isLinked) {
            actionBtn = `<button class="btn-mini btn-del" onclick="unlinkItem('${item.id}')" title="Verbindung lösen" style="background:#ef4444; color:white;">Trennen ❌</button>`;
        } else {
            actionBtn = `<button class="btn-mini btn-check" onclick="checkDbMatch('${item.id}')">Verbinden 🔗</button>`;
        }

        switch(item.trafficStatus) {
            case 'green': trafficClass='light-green'; statusMsg='Online'; break;
            case 'yellow': trafficClass='light-yellow'; statusMsg='Offline!'; break;
            case 'red': trafficClass='light-red'; statusMsg='Leer!'; break;
        }

        let imgHtml = '';
        if (item.image) {
            imgHtml = `<img src="${item.image}" style="width:60px; height:60px; object-fit:contain; background:#fff; margin-right:15px; border-radius:6px;">`;
        }

        const card = document.createElement('div');
        card.className = 'stock-card';
        card.dataset.search = (item.title + " " + (item.sku||"")).toLowerCase();
        
        let profitInfo = '';
        if (item.marketPrice > 0 && item.purchasePrice > 0) {
            const p = item.marketPrice - item.purchasePrice;
            const m = (p / item.purchasePrice) * 100;
            const color = p > 0 ? '#10b981' : '#ef4444';
            profitInfo = `<div style="font-size:0.8rem; color:${color}; margin-top:5px; font-weight:bold;">Gewinn: ${p.toFixed(2)}€ (${m.toFixed(0)}%)</div>`;
        }
        
        let watchInfo = '';
        if (item.competitors && item.competitors.length > 0) {
            watchInfo = `<span style="font-size:0.75rem; color:#94a3b8; margin-left:8px;">👁 ${item.competitors.length}</span>`;
        }

        card.innerHTML = `
            <div style="display:flex; padding:15px;">
                ${imgHtml}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:5px;">${item.title}</div>
                    <div style="font-size:0.85rem; display:flex; align-items:center;">
                        <span class="traffic-light ${trafficClass}"></span>
                        <span>${statusMsg}</span>
                        <span style="background:#334155; margin-left:8px; padding:2px 6px; border-radius:4px;">${item.sku||'-'}</span>
                        ${watchInfo}
                    </div>
                    ${profitInfo}
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; padding:12px; border-top:1px solid #334155; background:rgba(0,0,0,0.2);">
                <div style="display:flex; align-items:center;">
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', -1)" style="width:35px; height:35px; font-size:1.2rem;">-</button>
                   <b style="margin:0 12px; font-size:1.2rem;">${item.quantity}</b>
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', 1)" style="width:35px; height:35px; font-size:1.2rem;">+</button>
                </div>
                
                <div style="display:flex; gap:8px;">
                   <button class="btn-mini btn-del" onclick="window.deleteItem('${item.id}')" title="Löschen" style="color:#ef4444; border-color:#ef4444; padding:8px;">🗑️</button>
                   ${actionBtn}
                   <button class="btn-mini" onclick="openPrintModal('${item.id}')" title="Drucken" style="padding:8px;">🖨️</button>
                   <button class="btn-mini" onclick="openEditModal('${item.id}')" title="Bearbeiten" style="padding:8px;">✏️</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// --- RENDER SUCH-ERGEBNISSE (HANDY OPTIMIERT) ---
window.renderPriceResults = (results) => {
    const list = document.getElementById('price-results');
    if(!list) return;
    list.innerHTML = '';
    
    if(!results || results.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; font-size:1rem;">Nichts gefunden.</div>';
        return;
    }

    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'price-item';
        
        let priceVal = typeof res.price === 'number' ? res.price : parseFloat(res.price.replace(',', '.')) || 0;
        let imgUrl = res.image || '/img/placeholder.png'; // Reparierter Bild-Zugriff

        div.innerHTML = `
            <img src="${imgUrl}">
            <div class="price-info">
                <div class="price-title">${res.title}</div>
                <div class="price-meta">
                    <span class="price-source src-${res.source.toLowerCase()}">${res.source}</span>
                    <span class="price-val">${priceVal.toFixed(2).replace('.', ',')} €</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-left:10px;">
                <button class="btn-choose" id="btn-select">Wählen</button>
                <button class="btn-mini" id="btn-watch" style="background:#334155; padding:6px;">👁</button>
            </div>
        `;
        
        // --- BUTTON: WÄHLEN ---
        div.querySelector('#btn-select').onclick = (e) => {
            e.stopPropagation();
            document.getElementById('inp-title').value = res.title; 
            document.getElementById('inp-market-price').value = priceVal.toFixed(2);
            
            // AUTOMATISCHE 45% REGEL
            const myEk = (priceVal * 0.45).toFixed(2);
            document.getElementById('inp-price').value = myEk;

            document.getElementById('inp-source-url').value = res.url;
            document.getElementById('inp-source-name').value = res.source;
            if (res.image) document.getElementById('inp-image').value = res.image;
            
            list.style.display = 'none';
            window.calcProfit(); // Sofort Gewinn anzeigen
            if (navigator.vibrate) navigator.vibrate(50);
        };

        // --- BUTTON: WATCHLIST ---
        div.querySelector('#btn-watch').onclick = (e) => {
            e.stopPropagation();
            if(window.addToWatchlist) {
                window.addToWatchlist({
                    source: res.source,
                    url: res.url,
                    price: priceVal,
                    title: res.title
                });
            }
        };

        list.appendChild(div);
    });
};

// ... Match Render Funktion bleibt (kann bei Bedarf auch vergrößert werden) ...
window.renderMatchCandidates = (candidates, stockId, socket) => {
    // (Bestehender Code für Match-Liste, funktioniert schon gut)
    const listContainer = document.getElementById('match-candidates-list');
    if(!listContainer) return;
    listContainer.innerHTML = ''; 
    if (candidates && candidates.length > 0) {
        candidates.forEach(cand => {
            const score = cand.score ? Math.round(cand.score * 100) : 100;
            const color = score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#64748b');
            const el = document.createElement('div');
            el.className = 'match-candidate';
            el.style = "display:flex; align-items:center; padding:12px; border-bottom:1px solid #334155; cursor:pointer;";
            el.innerHTML = `
                <img src="${cand.image || '/img/placeholder.png'}" style="width:50px; height:50px; object-fit:cover; margin-right:12px; border-radius:4px; background:#fff;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:1rem; color:#fff;">${cand.title}</div>
                    <div style="font-size:0.85rem; color:#94a3b8;">${cand.status} • ${cand.price || 'VB'}</div>
                </div>
                <div style="background:${color}; color:white; padding:4px 10px; border-radius:12px; font-size:0.9rem; font-weight:bold;">
                    ${score === 100 && !cand.score ? '🔍' : score + '%'}
                </div>
            `;
            el.onclick = () => {
                if(confirm(`Mit "${cand.title}" verbinden?`)) {
                    socket.emit('confirm-link', { stockId: stockId, adId: cand.id, adImage: cand.image });
                    window.closeAllModals();
                }
            };
            listContainer.appendChild(el);
        });
    } else {
        listContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#64748b;">Keine passende Anzeige gefunden.<br><small>Tippe oben in die Suche 👆</small></div>';
    }
};