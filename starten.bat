@echo off
TITLE FactoryAI Shopfloor Server
echo ===================================================
echo Starte FactoryAI Backend ^& Frontend unter Windows...
echo ===================================================

:: Wechselt in den Ordner backend neben dieser Datei (z. B. D:\Shopfloor\backend)
cd /d "%~dp0backend"

:: Installiert fehlende Pakete
echo Pruefe und installiere API-Abhaengigkeiten...
call npm install --omit=dev

:: Startet den Server direkt
echo Starte den Node.js Express Server...
node server.js

pause
