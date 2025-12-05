// public/js/lager/main.js
const socket = io();
window.socket = socket; 
window.lastStockItems = [];
window.currentEditId = null;
let currentCheckId = null;

// Temporärer Speicher für Watchlist im Modal
let tempCompetitors = [];

socket.on('connect', () => socket.emit('get-stock'));
socket.on('force-reload-stock', () => {
    socket.emit('get-stock');
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
});

socket.on('update-stock', (items) => {
    window.lastStockItems = items || [];
    if(window.renderStock) window.renderStock(items);
});

// --- LOGIK ---
function generateAutoSKU() { 
    return "LAGER-" + Math.floor(1000 + Math.random() * 9000); 
}

// WATCHLIST FUNKTIONEN (NEU)
window.addToWatchlist = (item) => {
    // Prüfen ob schon drin
    if(tempCompetitors.some(c => c.url === item.url)) {
        alert("Ist schon in der Liste!");
        return;
    }
    tempCompetitors.push(item);
    window.renderCompetitorList(tempCompetitors);
    if (navigator.vibrate) navigator.vibrate(30); // Kurzes Feedback
};

window.removeCompetitor = (index) => {
    tempCompetitors.splice(index, 1);
    window.renderCompetitorList(tempCompetitors);
};

window.startPriceSearch = () => {
    const query = document.getElementById('inp-title').value;
    if(query.length < 3) return alert("Bitte Modellnamen eingeben!");
    
    const list = document.getElementById('price-results');
    if(list) {
        list.style.display = 'block';
        list.innerHTML = '<div style="padding:15px; text-align:center;">⏳ Suche läuft... (Top 25)</div>';
    }
    socket.emit('search-price-sources', query);
};

socket.on('price-search-results', (results) => {
    if(window.renderPriceResults) window.renderPriceResults(results);
});

// MATCH LOGIK
socket.on('db-match-result', (res) => {
    currentCheckId = res.stockId;
    const searchInput = document.getElementById('match-search');
    if (searchInput) searchInput.value = "";
    if (window.renderMatchCandidates) window.renderMatchCandidates(res.candidates, currentCheckId, socket);
    document.getElementById('match-modal').classList.add('open');
});

socket.on('db-match-search-results', (results) => {
    if (window.renderMatchCandidates && currentCheckId) {
        window.renderMatchCandidates(results, currentCheckId, socket);
    }
});

const matchSearchInput = document.getElementById('match-search');
if(matchSearchInput) {
    let timeout = null;
    matchSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if(val.length > 1) socket.emit('search-db-for-link', val);
        }, 300);
    });
}

// FEEDBACK
socket.on('export-progress', (msg) => window.showLoading("Verarbeite...", msg, true));
socket.on('export-success', (msg) => window.showLoading("Erfolg!", msg, false, true));
socket.on('export-error', (msg) => window.showLoading("Fehler", msg, false, false));

// CRUD
window.unlinkItem = (id) => { if(confirm("Verbindung lösen?")) socket.emit('unlink-stock-item', id); };

window.openCreateModal = () => {
    window.currentEditId = null;
    tempCompetitors = []; // Reset
    
    document.getElementById('modal-title').innerText = "Artikel anlegen";
    document.getElementById('inp-title').value = "";
    document.getElementById('inp-sku').value = generateAutoSKU();
    document.getElementById('inp-location').value = "";
    document.getElementById('inp-price').value = "";
    document.getElementById('inp-market-price').value = "";
    document.getElementById('inp-qty').value = "1";
    document.getElementById('inp-image').value = ""; 
    document.getElementById('price-results').style.display = 'none';
    document.getElementById('profit-badge').style.display = 'none';
    
    window.renderCompetitorList(tempCompetitors); // Leere Liste rendern
    document.getElementById('item-modal').classList.add('open');
};

window.openEditModal = (id) => {
    const item = window.lastStockItems.find(i => i.id === id);
    if(!item) return;
    window.currentEditId = id;
    
    // Bestehende Watchlist laden
    tempCompetitors = item.competitors ? [...item.competitors] : [];

    document.getElementById('modal-title').innerText = "Bearbeiten";
    document.getElementById('inp-title').value = item.title;
    document.getElementById('inp-sku').value = item.sku || generateAutoSKU();
    document.getElementById('inp-location').value = item.location || "";
    document.getElementById('inp-price').value = item.purchasePrice;
    document.getElementById('inp-market-price').value = item.marketPrice || "";
    document.getElementById('inp-qty').value = item.quantity;
    document.getElementById('inp-source-url').value = item.sourceUrl || "";
    document.getElementById('inp-source-name').value = item.sourceName || "";
    document.getElementById('inp-image').value = item.image || ""; 
    
    window.renderCompetitorList(tempCompetitors); // Liste anzeigen
    
    if(window.calcProfit) window.calcProfit();
    
    document.getElementById('item-modal').classList.add('open');
};

window.saveItem = () => {
    const data = {
        id: window.currentEditId,
        title: document.getElementById('inp-title').value,
        sku: document.getElementById('inp-sku').value,
        location: document.getElementById('inp-location').value,
        purchasePrice: document.getElementById('inp-price').value,
        quantity: document.getElementById('inp-qty').value,
        marketPrice: document.getElementById('inp-market-price').value,
        sourceUrl: document.getElementById('inp-source-url').value,
        sourceName: document.getElementById('inp-source-name').value,
        image: document.getElementById('inp-image').value,
        competitors: tempCompetitors // WICHTIG: Die Liste mitsenden!
    };
    if(!data.title) return alert("Titel fehlt");
    if(window.currentEditId) socket.emit('update-stock-details', data);
    else socket.emit('create-new-stock', data);
    
    if (navigator.vibrate) navigator.vibrate(100); 
    window.closeAllModals();
};

window.updateQty = (id, d) => socket.emit('update-stock-qty', { id, delta: d });

window.deleteItem = (id) => {
    if(!id && window.currentEditId) id = window.currentEditId;
    if(id && confirm("Wirklich löschen?")) {
        socket.emit('delete-stock-item', id);
        window.closeAllModals();
    }
};

window.checkDbMatch = (id) => socket.emit('request-db-match', id);

window.filterStock = () => {
    const term = document.getElementById('inp-search').value.toLowerCase();
    document.querySelectorAll('.stock-card').forEach(el => el.style.display = el.dataset.search.includes(term) ? 'flex' : 'none');
};