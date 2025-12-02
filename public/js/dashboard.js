// public/js/dashboard.js
const socket = io();

const elTotalAds = document.getElementById('stat-total-ads');
const elTotalViews = document.getElementById('stat-total-views');
const elOpenTasks = document.getElementById('stat-open-tasks');
const elTotalMsgs = document.getElementById('stat-total-msgs');
const elTopList = document.getElementById('top-list');
const inpSearch = document.getElementById('inp-search'); // Das Suchfeld

socket.emit('get-db-products'); 
socket.emit('get-tracking-data'); 
socket.emit('get-analytics-chart'); 

let performanceChart = null; 
let allAdsData = []; // HIER SPEICHERN WIR ALLE DATEN FÜR DIE SUCHE

// --- SUCH-LOGIK ---
if (inpSearch) {
    inpSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        // Filtern
        const filtered = allAdsData.filter(ad => {
            const title = (ad.title || "").toLowerCase();
            const id = (ad.id || "").toLowerCase();
            const status = (ad.status || "").toLowerCase();
            
            // Suche auch nach "gelöscht", wenn der Status so ist
            return title.includes(term) || id.includes(term) || status.includes(term);
        });
        
        renderTopAds(filtered);
    });
}


// --- CHART LOGIK ---
socket.on('update-analytics-chart', (data) => {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Besucher Gesamt',
                data: data.views,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
            }, {
                label: 'Merkliste Gesamt',
                data: data.favs,
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                tension: 0.3,
                borderWidth: 2,
                borderDash: [5, 5]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#999', font: { family: 'Outfit' } } },
                tooltip: { 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    titleColor: '#fff', 
                    bodyColor: '#ccc',
                    borderColor: '#333',
                    borderWidth: 1
                }
            },
            scales: {
                y: { 
                    grid: { color: '#222' }, 
                    ticks: { color: '#666', font: { family: 'Outfit' } } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#666', font: { family: 'Outfit' } } 
                }
            }
        }
    });
});

socket.on('update-db-list', (ads) => { processAds(ads); });
socket.on('update-db', (ads) => { processAds(ads); });

function processAds(ads) {
    if (!ads) return;
    
    // 1. Daten global speichern für die Suche
    allAdsData = ads;

    // Filter: Zähle nur aktive Anzeigen für die Statistik oben
    const activeAds = ads.filter(a => a.status === 'ACTIVE' || (!a.status && a.active));
    const deletedAds = ads.filter(a => a.status === 'DELETED');
    
    if(elTotalAds) {
        if(deletedAds.length > 0) {
            elTotalAds.innerHTML = `${activeAds.length} <span style="font-size:0.6em; color:#ef4444;">(${deletedAds.length} del)</span>`;
        } else {
            elTotalAds.innerText = activeAds.length;
        }
    }

    let totalViews = 0;
    let viewsDiff = 0;

    ads.forEach(ad => {
        totalViews += (parseInt(ad.views) || 0);
        if (ad.statsDiff && ad.statsDiff.views) {
            viewsDiff += ad.statsDiff.views;
        }
    });

    if(elTotalViews) {
        elTotalViews.innerHTML = `
            ${totalViews.toLocaleString()}
            ${viewsDiff > 0 ? `<span style="font-size:0.9rem; color:#10b981; margin-left:5px;">+${viewsDiff}</span>` : ''}
        `;
    }
    
    // Prüfen, ob gerade gesucht wird, sonst alles rendern
    const searchTerm = inpSearch ? inpSearch.value.toLowerCase() : "";
    if (searchTerm) {
        // Falls schon was im Suchfeld steht (z.B. nach Reload), Filter anwenden
        const filtered = allAdsData.filter(ad => {
            const title = (ad.title || "").toLowerCase();
            const id = (ad.id || "").toLowerCase();
            const status = (ad.status || "").toLowerCase();
            return title.includes(searchTerm) || id.includes(searchTerm) || status.includes(searchTerm);
        });
        renderTopAds(filtered);
    } else {
        renderTopAds(ads);
    }
}

socket.on('update-tasks', (tasks) => {
    if(elOpenTasks && tasks) {
        const open = tasks.filter(t => t.status === 'offen').length;
        elOpenTasks.innerText = open;
    }
});

socket.on('update-conversations', (data) => {
    if(elTotalMsgs) {
        const chats = Array.isArray(data) ? data : (data.chats || []);
        let unread = 0;
        chats.forEach(c => { if(c.hasNewMessage) unread++; });
        
        if(unread > 0) elTotalMsgs.innerHTML = `<span style="color:#ef4444;">${unread} NEU</span>`;
        else elTotalMsgs.innerText = chats.length;
    }
});

function renderTopAds(ads) {
    if(!elTopList) return;
    
    // Sortieren (Meiste Views zuerst)
    const sorted = [...ads].sort((a, b) => (parseInt(b.views)||0) - (parseInt(a.views)||0));
    
    // Limit erhöhen oder aufheben, da wir jetzt suchen können (z.B. 200 statt 100)
    const listToRender = sorted.slice(0, 200); 

    elTopList.innerHTML = '';
    if(listToRender.length === 0) {
        elTopList.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Keine Anzeigen gefunden.</div>';
        return;
    }

    listToRender.forEach((ad, index) => {
        const div = document.createElement('div');
        div.className = 'top-item';
        
        let imgUrl = 'https://via.placeholder.com/50';
        if (ad.images && ad.images.length > 0) imgUrl = ad.images[0];
        else if (ad.img) imgUrl = ad.img;

        // Visualisierung für gelöschte Items
        let titleClass = "item-title";
        let statusBadge = "";
        let opacity = "1";

        if(ad.status === 'DELETED') {
            titleClass += " text-danger"; // Roter Titel
            statusBadge = '<span style="color:#ef4444; font-size:0.8em; margin-left:5px;">[GELÖSCHT]</span>';
            opacity = "0.6";
        }

        div.style.opacity = opacity;
        div.innerHTML = `
            <div class="item-rank">#${index + 1}</div>
            <img src="${imgUrl}" class="item-img">
            <div class="item-info">
                <a href="${ad.url || '#'}" target="_blank" class="${titleClass}">${ad.title || 'Unbekannt'}</a>
                ${statusBadge}
                <div class="item-meta">ID: ${ad.id} • ${ad.price || ''}</div>
            </div>
            <div class="item-stats">
                <span class="stat-pill">👁 ${ad.views || 0}</span>
                ${ad.status === 'DELETED' ? 
                    `<button onclick="reuploadItem('${ad.id}')" style="margin-left:10px; background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:2px 8px; border-radius:4px;">♻️</button>` 
                    : ''}
            </div>
        `;
        elTopList.appendChild(div);
    });
}

// Neue Funktion für Reupload Button
function reuploadItem(id) {
    if(confirm('Diesen gelöschten Artikel wirklich neu hochladen?')) {
        // Wir nutzen einfach denselben Socket wie beim manuellen Upload, 
        // müssen ihn aber serverseitig vielleicht implementieren oder via POST machen.
        // Da du vorhin "poster.js" genutzt hast, nehme ich an, es gibt eine Route.
        // Falls nicht, müssen wir die bauen. Hier ein Platzhalter:
        alert("Funktion folgt! (Backend Route fehlt noch)");
    }
}

function triggerScan() {
    const btn = document.getElementById('btn-scan');
    if(btn) btn.innerHTML = "⏳ Starte...";
    socket.emit('start-db-scrape');
    setTimeout(() => { window.location.href = '/datenbank'; }, 1000);
}