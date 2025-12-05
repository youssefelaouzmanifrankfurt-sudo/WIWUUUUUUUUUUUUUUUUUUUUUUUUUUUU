@echo off
chcp 65001 >nul
cls

echo ==========================================
echo      UPLOAD ZU: home2 (youssefelaouzmanifrankfurt-sudo)
echo ==========================================
echo.

:: 1. In den Ordner der Datei wechseln
cd /d "%~dp0"

:: 2. Fehler-Reparatur (index.lock entfernen falls vorhanden)
if exist ".git\index.lock" (
    del ".git\index.lock" /f /q
)

:: 3. SICHERSTELLEN, DASS DER LINK STIMMT
:: Versucht erst, den Link hinzuzufügen (falls er fehlt)
git remote add origin https://github.com/youssefelaouzmanifrankfurt-sudo/home2.git 2>nul
:: Erzwingt dann, dass der Link korrekt gesetzt ist
git remote set-url origin https://github.com/youssefelaouzmanifrankfurt-sudo/home2.git

:: 4. Dateien hinzufügen
echo [1/3] Dateien werden gesammelt...
git add .

:: 5. Nachricht abfragen
set /p msg="Gib eine Notiz ein (oder druecke ENTER fuer Datum/Uhrzeit): "
if "%msg%"=="" set msg=Automatisches Update %date% %time%

:: 6. Commit erstellen
echo [2/3] Speichere Version...
git commit -m "%msg%"

:: 7. Hochladen
echo [3/3] Lade zu GitHub hoch...
git push origin main

echo.
echo ==========================================
echo      FERTIG!
echo ==========================================
pause