// src/socket/stock/helpers.js

function getBestImage(adItem) {
    if (!adItem) return null;
    if (Array.isArray(adItem.images) && adItem.images.length > 0) return adItem.images[0];
    if (adItem.img && adItem.img.length > 5) return adItem.img;
    if (adItem.image && adItem.image.length > 5) return adItem.image;
    return null; 
}

function parsePrice(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    return parseFloat(str.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
}

function calculateTrafficStatus(qty, adStatus) {
    const isOnline = (adStatus === 'ACTIVE');
    if (qty > 0 && isOnline) return 'green';
    if (qty > 0 && !isOnline) return 'yellow'; // Ware da, aber offline
    if (qty <= 0 && isOnline) return 'red';    // Ware weg, aber online
    return 'grey';
}

module.exports = { getBestImage, parsePrice, calculateTrafficStatus };