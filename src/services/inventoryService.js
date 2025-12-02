// src/services/inventoryService.js
const storage = require('../utils/storage');

const getAll = () => storage.loadDB();
const saveAll = (items) => storage.saveDB(items);

// --- LAGER STATUS MARKIEREN ---
const markAsInStock = (adId, stockLocation) => {
    const db = getAll();
    const ad = db.find(i => i.id === adId);
    if (ad) {
        ad.inStock = true;
        const tag = " [LAGER]";
        if (!ad.internalNote) ad.internalNote = "";
        if (!ad.internalNote.includes(tag)) ad.internalNote += tag;
        if (stockLocation) ad.stockLocation = stockLocation;
        saveAll(db);
        return true;
    }
    return false;
};

// --- LAGER STATUS ENTFERNEN (NEU) ---
const removeFromStock = (adId) => {
    const db = getAll();
    const ad = db.find(i => i.id === adId);
    if (ad) {
        ad.inStock = false;
        ad.stockLocation = null;
        
        // Tag aus Notiz entfernen
        if (ad.internalNote) {
            ad.internalNote = ad.internalNote.replace(" [LAGER]", "").trim();
        }
        
        saveAll(db);
        return true;
    }
    return false;
};

// --- SYNC ---
const syncWithScan = (scannedItems) => {
    const currentDB = getAll();
    let updatedDB = [];
    const dbMap = new Map(currentDB.map(item => [item.id, item]));
    const scannedIds = new Set();

    scannedItems.forEach(newItem => {
        scannedIds.add(newItem.id);
        const existingItem = dbMap.get(newItem.id);

        if (existingItem) {
            updatedDB.push({
                ...newItem,
                description: existingItem.description || newItem.description,
                images: (existingItem.images && existingItem.images.length > 0) ? existingItem.images : newItem.images,
                techData: (existingItem.techData && existingItem.techData.length > 0) ? existingItem.techData : newItem.techData,
                internalNote: existingItem.internalNote || "",
                isFavorite: existingItem.isFavorite || false,
                customTitle: existingItem.customTitle || "",
                features: existingItem.features || newItem.features,
                statsDiff: newItem.statsDiff || existingItem.statsDiff,
                status: newItem.status || 'ACTIVE',
                inStock: existingItem.inStock || false,
                stockLocation: existingItem.stockLocation || null
            });
        } else {
            updatedDB.push({ ...newItem, status: newItem.status || 'ACTIVE', inStock: false });
        }
    });
    
    currentDB.forEach(oldItem => {
        if (!scannedIds.has(oldItem.id)) {
            updatedDB.push({
                ...oldItem,
                status: 'DELETED',
                active: false,
                features: []
            });
        }
    });
    
    saveAll(updatedDB);
    return updatedDB;
};

// --- CRUD ---
const addFeature = (id, type, endDate) => {
    const db = getAll();
    const item = db.find(i => i.id === id);
    if (item) {
        if (!item.features) item.features = [];
        item.features = item.features.filter(f => f.type !== type);
        item.features.push({ type, endDate, active: true });
        saveAll(db);
    }
    return db;
};

const deleteItem = (id) => {
    let db = getAll();
    db = db.filter(i => i.id !== id);
    saveAll(db);
    return db;
};

const replaceAll = (items) => { saveAll(items); return items; };

const addFromStock = (stockItem) => {
    const db = getAll();
    const exists = db.find(i => i.title === stockItem.title);
    if (exists) return false; 

    const newAd = {
        id: "DRAFT-" + Date.now(),
        title: stockItem.title,
        price: stockItem.purchasePrice ? (parseFloat(stockItem.purchasePrice) * 2) + " €" : "VB",
        description: "Aus Lagerbestand importiert. Bitte bearbeiten.",
        images: [],
        uploadDate: new Date().toLocaleDateString('de-DE'),
        status: 'DRAFT', 
        active: false,
        views: 0,
        favorites: 0,
        inStock: true,
        internalNote: `Lagerort: ${stockItem.location || 'Unbekannt'} [LAGER]`
    };

    db.push(newAd);
    saveAll(db);
    return true;
};

module.exports = {
    getAll, saveAll, syncWithScan, addFeature, delete: deleteItem, replaceAll, addFromStock, 
    markAsInStock, removeFromStock // Exportieren!
};