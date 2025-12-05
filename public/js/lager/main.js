// public/js/lager/main.js
const socket = io();
window.socket = socket; 
window.lastStockItems = [];
window.currentEditId = null;
let currentCheckId = null;

socket.on('connect', () => socket.emit('get-stock'));
socket.on('force-reload-stock', () => socket.emit('get-stock'));

socket.on('update-stock', (items) => {
    window.lastStockItems = items || [];
    if(window.renderStock) window.renderStock(items);
});

// --- LOGIK ---
function generateAutoSKU() { 
    return "LAGER-" + Math.floor(1000 + Math.random() * 9000); 
}

window.startPriceSearch = () => {
    const query = document.getElementById('inp-title').value;
    if(query.length < 3) return alert("Bitte Modellnamen eingeben!");
    
    const list = document.getElementById('price-results');
    if(list) {
        list.style.display = 'block';
        list.innerHTML = '<div style="padding:15px; text-align:center;">⏳ Suche läuft...</div>';
    }
    socket.emit('search-price-sources', query);
};

socket.on('price-search-results', (results) => {
    if(window.renderPriceResults) window.renderPriceResults(results);
});

// MATCH: Ergebnis der automatischen Suche
socket.on('db-match-result', (res) => {
    currentCheckId = res.stockId;
    
    // Leere das Suchfeld beim Öffnen
    const searchInput = document.getElementById('match-search');
    if (searchInput) searchInput.value = "";

    // Benutze die neue Render-Funktion aus ui.js
    if (window.renderMatchCandidates) {
        window.renderMatchCandidates(res.candidates, currentCheckId, socket);
    }

    // Setup Auto Create Button
    const btnCreate = document.getElementById('btn-auto-create-ad');
    if(btnCreate) {
        btnCreate.onclick = () => {
            if(confirm("Soll ein Entwurf automatisch erstellt werden?")) {
                socket.emit('auto-create-ad', currentCheckId);
            }
        };
    }

    const modal = document.getElementById('match-modal');
    if(modal) modal.classList.add('open');
});

// MATCH: Ergebnis der MANUELLEN Suche
socket.on('db-match-search-results', (results) => {
    if (window.renderMatchCandidates && currentCheckId) {
        window.renderMatchCandidates(results, currentCheckId, socket);
    }
});

// MATCH: Suche Event Listener
const matchSearchInput = document.getElementById('match-search');
if(matchSearchInput) {
    let timeout = null;
    matchSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearTimeout(timeout);
        
        // Verzögerung, damit wir den Server nicht bei jedem Buchstaben nerven
        timeout = setTimeout(() => {
            if(val.length > 1) {
                socket.emit('search-db-for-link', val);
            }
        }, 300);
    });
}

// --- FEEDBACK ---
socket.on('export-progress', (msg) => window.showLoading("Verarbeite...", msg, true));
socket.on('export-success', (msg) => window.showLoading("Erfolg!", msg, false, true));
socket.on('export-error', (msg) => window.showLoading("Fehler", msg, false, false));

// --- CRUD ---
window.unlinkItem = (id) => { if(confirm("Verbindung lösen?")) socket.emit('unlink-stock-item', id); };

window.openCreateModal = () => {
    window.currentEditId = null;
    document.getElementById('modal-title').innerText = "Artikel anlegen";
    document.getElementById('inp-title').value = "";
    document.getElementById('inp-sku').value = generateAutoSKU();
    document.getElementById('inp-location').value = "";
    document.getElementById('inp-price').value = "";
    document.getElementById('inp-market-price').value = "";
    document.getElementById('inp-qty').value = "1";
    document.getElementById('price-results').style.display = 'none';
    document.getElementById('item-modal').classList.add('open');
};

window.openEditModal = (id) => {
    const item = window.lastStockItems.find(i => i.id === id);
    if(!item) return;
    window.currentEditId = id; 
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
    const data = {
        id: window.currentEditId,
        title: document.getElementById('inp-title').value,
        sku: document.getElementById('inp-sku').value,
        location: document.getElementById('inp-location').value,
        purchasePrice: document.getElementById('inp-price').value,
        quantity: document.getElementById('inp-qty').value,
        marketPrice: document.getElementById('inp-market-price').value,
        sourceUrl: document.getElementById('inp-source-url').value,
        sourceName: document.getElementById('inp-source-name').value
    };
    if(!data.title) return alert("Titel fehlt");
    if(window.currentEditId) socket.emit('update-stock-details', data);
    else socket.emit('create-new-stock', data);
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