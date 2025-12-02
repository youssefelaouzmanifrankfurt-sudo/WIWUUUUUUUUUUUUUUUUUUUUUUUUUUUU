// src/socket/stock/index.js
const reader = require('./reader');
const writer = require('./writer');

module.exports = (io, socket) => {
    reader(io, socket);
    writer(io, socket);
};