// public/js/lager/main.js
const socket = io();
window.socket = socket; 
window.lastStockItems = [];
window.currentEditId = null;
let tempCompetitors = [];
let isSetSearchMode = false; // Status merken

// ... (Standard Socket Events bleiben gleich) ...
socket.on('connect', () => socket.emit('get-stock'));
socket.on('update-stock', (items) => { window.lastStockItems = items || []; if(window.renderStock) window.renderStock(items); });

// --- NEU: SET FINDER LOGIK ---
window.findSets = () => {
    let query = document.getElementById('inp-title').value;
    if(query.length < 2) return alert("Tippe erst den Modellnamen ein (z.B. Heko)");
    
    isSetSearchMode = true; // Wir suchen Sets
    const list = document.getElementById('price-results');
    list.style.display = 'block';
    list.innerHTML = '<div style="padding:15px; text-align:center;">🔎 Suche Sets für "'+query+'"...</div>';
    
    // Suche nach "Name Set"
    socket.emit('search-price-sources', query + " Set");
};

window.startPriceSearch = () => {
    const query = document.getElementById('inp-title').value;
    if(query.length < 2) return alert("Bitte Namen eingeben!");
    
    isSetSearchMode = false; // Normale Suche
    const list = document.getElementById('price-results');
    document.getElementById('suggestion-chips').style.display = 'none'; // Vorschläge weg
    list.style.display = 'block';
    list.innerHTML = '<div style="padding:15px; text-align:center;">⏳ Suche Preise...</div>';
    
    socket.emit('search-price-sources', query);
};

socket.on('price-search-results', (results) => {
    if (isSetSearchMode) {
        // Wenn wir im Set-Modus sind, zeigen wir Vorschläge
        if(window.renderSuggestions) window.renderSuggestions(results);
        isSetSearchMode = false; // Reset
    } else {
        // Sonst normale Liste
        if(window.renderPriceResults) window.renderPriceResults(results);
    }
});

// ... (Rest der CRUD Funktionen, Watchlist Refresh etc. wie gehabt) ...
// Hier nur kurz die Refresh Funktion, falls sie fehlt:
window.refreshCompetitor = (index, url) => {
    const el = document.getElementById(`comp-price-${index}`);
    if(el) el.innerHTML = "⏳";
    socket.emit('check-competitor-price', { index, url });
};

socket.on('competitor-price-result', (res) => {
    if(tempCompetitors[res.index]) {
        tempCompetitors[res.index].price = res.price;
        window.renderCompetitorList(tempCompetitors);
    }
});

// ... Rest wie createModal, saveItem etc. ...