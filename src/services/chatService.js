// src/services/chatService.js
const chatController = require('../scrapers/chatController');
const logger = require('../utils/logger');

class ChatService {
    constructor() {
        // Hier speichern wir die Daten (statt global)
        this.conversationCache = [];
        this.chatCache = {};
        console.log("[SERVICE] ChatService bereit.");
    }

    /**
     * Gibt die aktuell gespeicherte Liste zurück (sofort).
     */
    getCachedList() {
        return this.conversationCache;
    }

    /**
     * Lädt die Liste frisch vom Browser.
     */
    async fetchConversations(count = 20) {
        try {
            const chats = await chatController.getConversations(count);
            // Cache aktualisieren
            this.conversationCache = chats;
            return chats;
        } catch (e) {
            logger.log('error', 'Chat-Liste Fehler: ' + e.message);
            return this.conversationCache; // Alte Daten zurückgeben bei Fehler
        }
    }

    /**
     * Gibt Nachrichten eines Chats zurück (Cache + Live-Option).
     */
    async getMessages(chatId, forceLoad = false, loadHistory = false) {
        // 1. Cache zurückgeben, wenn wir nicht zwingend laden müssen
        if (!forceLoad && !loadHistory && this.chatCache[chatId]) {
            return { 
                chatId, 
                messages: this.chatCache[chatId], 
                fromCache: true 
            };
        }

        // 2. Frisch laden
        try {
            const result = await chatController.loadChatMessages(chatId, loadHistory);
            if (result && result.messages) {
                this.chatCache[chatId] = result.messages; // Cache update
                return { 
                    chatId, 
                    messages: result.messages, 
                    fromCache: false,
                    isHistory: loadHistory 
                };
            }
        } catch (e) {
            logger.log('error', 'Nachrichten Fehler: ' + e.message);
        }
        
        return null;
    }

    /**
     * Sendet eine Nachricht und gibt den neuen Verlauf zurück.
     */
    async sendMessage(chatId, text) {
        try {
            // 1. Senden (mit Sicherheits-Klick auf den Namen via Controller)
            const success = await chatController.sendMessage(chatId, text);
            
            if (success) {
                // 2. Kurz warten (DOM Update bei Kleinanzeigen)
                // Wir geben der Seite 4 Sekunden Zeit, die neue Nachricht anzuzeigen
                await new Promise(r => setTimeout(r, 4000));
                
                // 3. Verlauf neu laden (damit der Server-Stand aktuell ist)
                return await this.getMessages(chatId, true);
            }
        } catch (e) {
            logger.log('error', 'Sende-Service Fehler: ' + e.message);
        }
        return null;
    }
}

// Singleton exportieren
module.exports = new ChatService();