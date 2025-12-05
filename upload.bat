@echo off
chcp 65001 >nul
cls

echo ==========================================
echo      SYNCHRONISIERUNG GITHUB
echo ==========================================
echo.

cd /d "%~dp0"

:: 1. Fehler-Reparatur (index.lock entfernen)
if exist ".git\index.lock" (
    del ".git\index.lock" /f /q
)

:: 2. Sicherstellen, dass der Link stimmt
git remote add origin https://github.com/youssefelaouzmanifrankfurt-sudo/home2.git 2>nul
git remote set-url origin https://github.com/youssefelaouzmanifrankfurt-sudo/home2.git

:: 3. ERST RUNTERLADEN (Wichtig für neuen PC)
echo [1/4] Hole neuste Daten von GitHub (Pull)...
git pull origin main --no-rebase

:: 4. Dateien hinzufügen
echo [2/4] Sammle lokale Dateien (Add)...
git add .

:: 5. Commit erstellen
set /p msg="Gib eine Notiz ein (oder druecke ENTER): "
if "%msg%"=="" set msg=Update %date% %time%
echo [3/4] Speichere Version (Commit)...
git commit -m "%msg%"

:: 6. Hochladen
echo [4/4] Lade zu GitHub hoch (Push)...
git push origin main

echo.
echo ==========================================
echo      FERTIG!
echo ==========================================
pause