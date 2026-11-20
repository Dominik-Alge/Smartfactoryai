@echo off
TITLE FactoryAI Shopfloor Server
echo ===================================================
echo Starte FactoryAI Backend ^& Frontend unter Windows...
echo ===================================================

:: Wechselt sicher in das richtige Verzeichnis
cd /d "C:\Smartfactoryai\backend"

:: Installiert fehlende Pakete
echo Pruefe und installiere API-Abhaengigkeiten...
call npm install --production

:: Startet den Server direkt
echo Starte den Node.js Express Server...
node server.js

pause
