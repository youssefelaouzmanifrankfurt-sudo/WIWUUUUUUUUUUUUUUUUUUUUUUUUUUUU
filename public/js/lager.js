// public/js/lager.js
const socket = io();
window.lastStockItems = [];
window.currentEditId = null;
let currentCheckId = null;

// --- INIT ---
socket.on('connect', () => socket.emit('get-stock'));
socket.on('force-reload-stock', () => socket.emit('get-stock'));

socket.on('update-stock', (items) => {
    window.lastStockItems = items || [];
    renderStock(items);
});

// --- HELPER ---
function generateAutoSKU() { 
    return "LAGER-" + Math.floor(1000 + Math.random() * 9000); 
}

// --- SUCHE & IMPORT ---
window.startPriceSearch = () => {
    const query = document.getElementById('inp-title').value;
    if(query.length < 3) return alert("Bitte Modellnamen eingeben!");
    
    const list = document.getElementById('price-results');
    list.style.display = 'block';
    list.innerHTML = '<div style="padding:15px; text-align:center;">⏳ Suche läuft...</div>';
    
    socket.emit('search-price-sources', query);
};

socket.on('price-search-results', (results) => {
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

socket.on('db-match-result', (res) => {
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
                    socket.emit('confirm-link', { stockId: currentCheckId, adId: cand.id, adImage: cand.image });
                    closeAllModals();
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
            if(confirm("Soll ein Entwurf automatisch erstellt werden?")) {
                socket.emit('auto-create-ad', currentCheckId);
            }
        };
    }
    document.getElementById('match-modal').classList.add('open');
});

// --- FEEDBACK ---
socket.on('export-progress', (msg) => showLoading("Verarbeite...", msg, true));
socket.on('export-success', (msg) => showLoading("Erfolg!", msg, false, true));
socket.on('export-error', (msg) => showLoading("Fehler", msg, false, false));

function showLoading(title, text, loading, success = false) {
    closeAllModals();
    const modal = document.getElementById('loading-modal');
    document.getElementById('loading-title').innerText = title;
    document.getElementById('loading-text').innerText = text;
    document.getElementById('loading-spinner').innerText = loading ? "⏳" : (success ? "✅" : "❌");
    
    const btn = document.getElementById('btn-loading-ok');
    btn.style.display = loading ? 'none' : 'block';
    btn.innerText = success ? "OK" : "Schließen";
    btn.onclick = () => closeAllModals();
    
    modal.classList.add('open');
}

// --- ACTIONS ---
window.unlinkItem = (id) => {
    if(confirm("Verbindung lösen?")) socket.emit('unlink-stock-item', id);
};

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
    closeAllModals();
};

window.updateQty = (id, d) => socket.emit('update-stock-qty', { id, delta: d });

window.deleteItem = (id) => {
    if(!id && window.currentEditId) id = window.currentEditId;
    if(id && confirm("Wirklich löschen?")) {
        socket.emit('delete-stock-item', id);
        closeAllModals();
    }
};

window.checkDbMatch = (id) => socket.emit('request-db-match', id);

window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));
window.filterStock = () => {
    const term = document.getElementById('inp-search').value.toLowerCase();
    document.querySelectorAll('.stock-card').forEach(el => el.style.display = el.dataset.search.includes(term) ? 'flex' : 'none');
};

// --- RENDER FUNKTION ---
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

        // Bild-Logik vereinfacht, um Syntaxfehler zu vermeiden
        let imgHtml = '';
        if (item.image) {
            imgHtml = `<img src="${item.image}" style="width:50px; height:50px; object-fit:contain; background:#fff; margin-right:10px;">`;
        }

        const card = document.createElement('div');
        card.className = 'stock-card';
        card.dataset.search = (item.title + " " + (item.sku||"")).toLowerCase();
        
        card.innerHTML = `
            <div style="display:flex; padding:10px;">
                ${imgHtml}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                    <div style="font-size:0.8rem; margin-top:5px; display:flex; align-items:center;">
                        <span class="traffic-light ${trafficClass}"></span>
                        <span>${statusMsg}</span>
                        <span style="background:#334155; margin-left:5px; padding:2px 5px; border-radius:3px;">${item.sku||'-'}</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px; border-top:1px solid #334155; background:rgba(0,0,0,0.2);">
                <div style="display:flex; align-items:center;">
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', -1)">-</button>
                   <b style="margin:0 8px; font-size:1.1rem;">${item.quantity}</b>
                   <button class="btn-mini" onclick="window.updateQty('${item.id}', 1)">+</button>
                </div>
                
                <div style="display:flex; gap:5px;">
                   <button class="btn-mini btn-del" onclick="window.deleteItem('${item.id}')" title="Löschen" style="color:#ef4444; border-color:#ef4444;">🗑️</button>
                   ${actionBtn}
                   <button class="btn-mini" onclick="openPrintModal('${item.id}')" title="Drucken">🖨️</button>
                   <button class="btn-mini" onclick="openEditModal('${item.id}')" title="Bearbeiten">✏️</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- DRUCKEN & SCANNER HELPER ---
window.triggerCamera = () => document.getElementById('cam-input').click();
window.startCropping = (inp) => {
    if(inp.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('image-to-crop').src = e.target.result;
            document.getElementById('crop-modal').classList.add('open');
            if(window.cropper) window.cropper.destroy();
            window.cropper = new Cropper(document.getElementById('image-to-crop'), {viewMode:1});
        };
        r.readAsDataURL(inp.files[0]);
    }
    inp.value='';
};
window.performOCR = () => {
    if(!window.cropper) return;
    const btn = document.getElementById('btn-ocr'); btn.innerText="...";
    window.cropper.getCroppedCanvas().toBlob(async(b) => {
        const fd = new FormData(); fd.append('image', b, 's.jpg');
        try {
            const r = await fetch('/api/scan-image', {method:'POST', body:fd});
            const d = await r.json();
            if(d.success) socket.emit('check-scan', d.model); else alert("Nichts erkannt");
        } catch(e){}
        closeAllModals(); btn.innerText="Text scannen";
    }, 'image/jpeg');
};
window.openPrintModal = async (id) => {
    const item = window.lastStockItems.find(i => i.id === id);
    if(!item) return;
    const codeContent = item.sku || item.id; 
    try {
        const res = await fetch(`/api/qr/${encodeURIComponent(codeContent)}`);
        const data = await res.json();
        if(data.url) {
            document.getElementById('print-qr').src = data.url;
            document.getElementById('print-title').innerText = item.title.substring(0, 30);
            document.getElementById('print-sku').innerText = item.sku || "Keine SKU";
            document.getElementById('print-modal').classList.add('open');
        }
    } catch(e) { alert("Fehler"); }
};
window.printLabel = () => {
    const content = document.getElementById('print-area').innerHTML;
    const win = window.open('', '', 'height=400,width=400');
    win.document.write('<html><head><title>Label</title><style>body{font-family:sans-serif;text-align:center;}img{width:100%;max-width:200px;}</style></head><body>' + content + '</body></html>');
    win.document.close();
    win.print();
};
window.triggerManualScan = () => {
    const val = document.getElementById('manual-code-input').value;
    if(val) { socket.emit('check-scan', val); document.getElementById('manual-code-input').value=""; }
};