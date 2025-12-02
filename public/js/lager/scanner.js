// public/js/lager/scanner.js

let html5QrcodeScanner = null;

// --- 1. QR CODE SCANNER (LIVE KAMERA) ---
window.startQRScanner = () => {
    document.getElementById('qr-scanner-modal').classList.add('open');
    
    // Scanner initialisieren
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, // Rückkamera bevorzugen
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText, decodedResult) => {
            // Erfolg! Code gefunden
            console.log(`Scan result: ${decodedText}`);
            // Wir nutzen den globalen Socket aus main.js/ejs
            window.socket.emit('check-scan', decodedText);
            window.stopQRScanner(); 
        },
        (errorMessage) => {
            // Scannt gerade nichts... (ignorieren)
        }
    ).catch(err => {
        alert("Kamera konnte nicht gestartet werden: " + err);
        window.stopQRScanner();
    });
};

window.stopQRScanner = () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            document.getElementById('qr-scanner-modal').classList.remove('open');
        }).catch(err => {
            console.log("Stop failed: ", err);
            document.getElementById('qr-scanner-modal').classList.remove('open');
        });
    } else {
        document.getElementById('qr-scanner-modal').classList.remove('open');
    }
};

// --- 2. MODELL TEXT SCANNER (FOTO & OCR) ---
window.triggerCamera = () => document.getElementById('cam-input').click();

window.startCropping = (inp) => {
    if (inp.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('image-to-crop').src = e.target.result;
            document.getElementById('crop-modal').classList.add('open');
            
            // Cropper neu starten
            if (window.cropper) window.cropper.destroy();
            window.cropper = new Cropper(document.getElementById('image-to-crop'), { viewMode: 1 });
        };
        r.readAsDataURL(inp.files[0]);
    }
    inp.value = '';
};

window.performOCR = () => {
    if (!window.cropper) return;
    
    const btn = document.getElementById('btn-ocr'); 
    btn.innerText = "Verarbeite...";
    
    window.cropper.getCroppedCanvas().toBlob(async (b) => {
        const fd = new FormData(); 
        fd.append('image', b, 's.jpg');
        
        try {
            const r = await fetch('/api/scan-image', { method: 'POST', body: fd });
            const d = await r.json();
            
            if (d.success) {
                window.socket.emit('check-scan', d.model); 
            } else {
                alert("Nichts erkannt: " + d.error);
            }
        } catch (e) {
            console.error(e);
            alert("Scan Fehler");
        }
        
        closeAllModals(); 
        btn.innerText = "Text scannen";
    }, 'image/jpeg');
};