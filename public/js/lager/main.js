// public/js/lager/main.js

// Globale Variablen für andere Module verfügbar machen
window.socket = io();
window.lastStockItems = [];
let currentEditId = null;
let currentCheckId = null;

// --- INIT ---
window.socket.on('connect', () => window.socket.emit('get-stock'));
window.socket.on('force-reload-stock', () => window.socket.emit('get-stock'));

window.socket.on('update-stock', (items) => {
    window.lastStockItems = items || [];
    renderStock(items);
});

// --- HELPER ---
function generateAutoSKU() { 
    return "LAGER-" + Math.floor(1000 + Math.random() * 9000); 
}

// --- PREIS SUCHE (Otto, Idealo, Amazon, Baur) ---
window.startPriceSearch = () => {
    const query = document.getElementById('inp-title').value;
    if(query.length < 3) return alert("Bitte Modellnamen eingeben!");
    
    const list = document.getElementById('price-results');
    list.style.display = 'block';
    list.innerHTML = '<div style="padding:15px; text-align:center;">⏳ Suche läuft...</div>';
    
    window.socket.emit('search-price-sources', query);
};

window.socket.on('price-search-results', (results) => {
    const list = document.getElementById('price-results');
    list.innerHTML = '';
    
    if(!results || results.length === 0) {
        list.innerHTML = '<div style="padding:10px; text-align:center;">Nichts gefunden. Manuell eingeben.</div>';
        return;
    }

    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'price-item';
        div.innerHTML = `
            <img src="${res.image || '/img/placeholder.png'}">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.9rem;">${res.title}</div>
                <div style="display:flex; align-items:center; margin-top:2px;">
                    <span class="price-source src-${res.source.toLowerCase()}">${res.source}</span>
                    <span style="color:#10b981; font-weight:bold;">${typeof res.price === 'number' ? res.price.toFixed(2).replace('.', ',') : res.price} €</span>
                </div>
            </div>
            <button class="btn-mini">Übernehmen</button>
        `;
        
        div.onclick = () => {
            document.getElementById('inp-title').value = res.title; 
            let priceVal = res.price;
            if(typeof priceVal === 'string') priceVal = parseFloat(priceVal.replace(',', '.'));
            document.getElementById('inp-market-price').value = priceVal.toFixed(2);
            document.getElementById('inp-price').value = (priceVal * 0.45).toFixed(2);
            document.getElementById('inp-source-url').value = res.url;
            document.getElementById('inp-source-name').value = res.source;
            list.style.display = 'none';
        };
        list.appendChild(div);
    });
});

// --- MATCH LISTE & AUTO-IMPORT ---
window.socket.on('db-match-result', (res) => {
    currentCheckId = res.stockId;
    const listContainer = document.getElementById('match-candidates-list');
    listContainer.innerHTML = ''; 

    if (res.candidates && res.candidates.length > 0) {
        res.candidates.forEach(cand => {
            const score = Math.round(cand.score * 100);
            const color = score > 80 ? '#10b981' : '#f59e0b';
            
            const el = document.createElement('div');
            el.className = 'match-candidate';
            el.style = "display:flex; align-items:center; padding:10px; border-bottom:1px solid #334155; cursor:pointer;";
            el.innerHTML = `
                <img src="${cand.image || '/img/placeholder.png'}" style="width:40px; height:40px; object-fit:cover; margin-right:10px; border-radius:4px; background:#fff;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.95rem; color:#fff;">${cand.title}</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">${cand.status} • ${cand.price || 'VB'}</div>
                </div>
                <div style="background:${color}; color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">${score}%</div>
            `;
            el.onclick = () => {
                if(confirm(`Mit "${cand.title}" verbinden?`)) {
                    window.socket.emit('confirm-link', { stockId: currentCheckId, adId: cand.id, adImage: cand.image });
                    window.closeAllModals();
                }
            };
            listContainer.appendChild(el);
        });
    } else {
        listContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#64748b;">Keine ähnliche Anzeige gefunden.<br><small>Nutze den Button unten 👇</small></div>';
    }

    const btnCreate = document.getElementById('btn-auto-create-ad');
    if(btnCreate) {
        btnCreate.onclick = () => {
            if(confirm("Soll ein Entwurf automatisch aus den Lager-Daten erstellt werden? (Scraping startet...)")) {
                window.socket.emit('auto-create-ad', currentCheckId);
            }
        };
    }
    document.getElementById('match-modal').classList.add('open');
});

// --- FEEDBACK & LADE SCREEN ---
window.socket.on('export-progress', (msg) => {
    window.closeAllModals();
    const modal = document.getElementById('loading-modal');
    if(modal) {
        document.getElementById('loading-text').innerText = msg;
        document.getElementById('loading-subtext').innerText = "Bitte warten, Daten werden verarbeitet...";
        document.getElementById('loading-spinner').innerText = "⏳";
        document.getElementById('loading-spinner').style.animation = "pulse 1.5s infinite";
        document.getElementById('btn-loading-ok').style.display = 'none';
        modal.classList.add('open');
    }
});

window.socket.on('export-success', (msg) => {
    const modal = document.getElementById('loading-modal');
    if(modal) {
        document.getElementById('loading-text').innerText = "Ist in Ablage!";
        document.getElementById('loading-subtext').innerText = msg;
        document.getElementById('loading-spinner').innerText = "✅";
        document.getElementById('loading-spinner').style.animation = "none";
        const btn = document.getElementById('btn-loading-ok');
        btn.style.display = 'block';
        btn.innerText = "Super -> OK";
        btn.onclick = () => window.closeAllModals();
        modal.classList.add('open');
    }
});

window.socket.on('export-error', (msg) => {
    const modal = document.getElementById('loading-modal');
    if(modal) {
        document.getElementById('loading-title').innerText = "Fehler";
        document.getElementById('loading-text').innerText = "Das hat nicht geklappt.";
        document.getElementById('loading-subtext').innerText = msg;
        document.getElementById('loading-spinner').innerText = "❌";
        const btn = document.getElementById('btn-loading-ok');
        btn.style.display = 'block';
        btn.innerText = "Schließen";
        btn.style.background = "#ef4444";
        btn.onclick = () => window.closeAllModals();
        modal.classList.add('open');
    }
});

// --- CRUD & HELPERS ---
window.unlinkItem = (id) => { if(confirm("Trennen?")) window.socket.emit('unlink-stock-item', id); };
window.updateQty = (id, d) => window.socket.emit('update-stock-qty', { id, delta: d });
window.deleteItem = (id) => { if(confirm("Löschen?")) window.socket.emit('delete-stock-item', id); };
window.checkDbMatch = (id) => window.socket.emit('request-db-match', id);

window.triggerManualScan = () => {
    const val = document.getElementById('manual-code-input').value;
    if(val) { window.socket.emit('check-scan', val); document.getElementById('manual-code-input').value=""; }
};

window.openCreateModal = (id) => {
    currentEditId = null;
    document.getElementById('modal-title').innerText = "Artikel anlegen";
    document.getElementById('inp-sku').value = generateAutoSKU();
    document.getElementById('inp-title').value = ""; document.getElementById('inp-price').value = "";
    document.getElementById('price-results').style.display='none';
    document.getElementById('item-modal').classList.add('open');
};

window.openEditModal = (id) => {
    const item = window.lastStockItems.find(x => x.id === id);
    if(!item) return;
    currentEditId = id;
    document.getElementById('modal-title').innerText = "Bearbeiten";
    document.getElementById('inp-title').value = item.title;
    document.getElementById('inp-sku').value = item.sku || generateAutoSKU();
    document.getElementById('inp-location').value = item.location || "";
    document.getElementById('inp-price').value = item.purchasePrice;
    document.getElementById('inp-market-price').value = item.marketPrice || "";
    document.getElementById('inp-qty').value = item.quantity;
    document.getElementById('inp-source-url').value = item.sourceUrl || "";
    document.getElementById('inp-source-name').value = item.sourceName || "";
    document.getElementById('item-modal').classList.add('open');
};

window.saveItem = () => {
    const d = {
        id: currentEditId,
        title: document.getElementById('inp-title').value,
        sku: document.getElementById('inp-sku').value,
        location: document.getElementById('inp-location').value,
        purchasePrice: document.getElementById('inp-price').value,
        quantity: document.getElementById('inp-qty').value,
        marketPrice: document.getElementById('inp-market-price').value,
        sourceUrl: document.getElementById('inp-source-url').value,
        sourceName: document.getElementById('inp-source-name').value
    };
    if(!d.title) return alert("Titel fehlt");
    if(currentEditId) window.socket.emit('update-stock-details', d); 
    else window.socket.emit('create-new-stock', d);
    window.closeAllModals();
};

window.closeAllModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));
    if(window.stopQRScanner) window.stopQRScanner(); // Stoppt Scanner falls offen
};

window.filterStock = () => {
    const term = document.getElementById('inp-search').value.toLowerCase();
    document.querySelectorAll('.stock-card').forEach(el => el.style.display = el.dataset.search.includes(term) ? 'flex' : 'none');
};

// --- RENDER ---
function renderStock(items) {
    const grid = document.getElementById('stock-grid');
    grid.innerHTML = '';
    const priority = { 'red': 4, 'yellow': 3, 'green': 2, 'grey': 1 };
    items.sort((a,b) => priority[b.trafficStatus] - priority[a.trafficStatus]);
    document.getElementById('stat-total').innerText = items.reduce((acc, i) => acc + (parseInt(i.quantity)||0), 0);

    items.forEach(item => {
        let trafficClass = 'light-grey';
        let statusMsg = 'Inaktiv';
        let actionBtn = '';
        if (item.isLinked) actionBtn = `<button class="btn-mini btn-del" onclick="unlinkItem('${item.id}')" style="background:#ef4444;">Trennen ❌</button>`;
        else actionBtn = `<button class="btn-mini btn-check" onclick="checkDbMatch('${item.id}')">Verbinden 🔗</button>`;

        switch(item.trafficStatus) {
            case 'green': trafficClass='light-green'; statusMsg='Online'; break;
            case 'yellow': trafficClass='light-yellow'; statusMsg='Offline!'; break;
            case 'red': trafficClass='light-red'; statusMsg='Leer!'; break;
        }

        const card = document.createElement('div');
        card.className = 'stock-card';
        card.dataset.search = (item.title + " " + (item.sku||"")).toLowerCase();
        card.innerHTML = `
            <div style="display:flex; padding:10px;">
                ${item.image ? `<img src="${item.image}" style="width:50px; height:50px; object-fit:contain; background:#fff; margin-right:10px;">` : ''}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                    <div style="font-size:0.8rem; margin-top:5px; display:flex; align-items:center;">
                        <span class="traffic-light ${trafficClass}"></span>
                        <span>${statusMsg}</span>
                        <span style="background:#334155; margin-left:5px; padding:2px 5px; border-radius:3px;">${item.sku||'-'}</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px; border-top:1px solid #334155;">
                <div>
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', -1)">-</button>
                   <b style="margin:0 5px;">${item.quantity}</b>
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', 1)">+</button>
                </div>
                <div style="display:flex; gap:5px;">${actionBtn}
                   <button class="btn-mini" onclick="openPrintModal('${item.id}')" title="Label drucken">🖨️</button>
                   <button class="btn-mini" onclick="openEditModal('${item.id}')">✏️</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}