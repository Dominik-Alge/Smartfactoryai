@echo off
setlocal
chcp 65001 >nul
TITLE FactoryAI Shopfloor - Update
REM =========================================================================
REM  UPDATE AUF DEM WINDOWS-SERVER
REM  -------------------------------------------------------------------------
REM  So verwenden:
REM    1. Neue Version (ZIP von GitHub) in einen EIGENEN Ordner entpacken,
REM       z. B. C:\Update\Smartfactoryai-main  (NICHT nach C:\Smartfactoryai)
REM    2. Laufenden Server beenden: im PowerShell-Fenster, in dem der Server
REM       läuft, Ctrl+C drücken bzw. das Fenster schliessen
REM    3. Diese Datei im entpackten Ordner per Doppelklick starten
REM
REM  Was das Skript tut:
REM    1. Sichert die komplette bisherige Installation inkl. Daten nach
REM       C:\Smartfactoryai_Backup\<Datum_Zeit>
REM    2. Kopiert den neuen Code nach C:\Smartfactoryai.
REM       Der Ordner backend\shopfloor_data und die Datei backend\.env
REM       werden dabei NICHT angefasst.
REM    3. Installiert die Pakete und baut das Frontend neu.
REM
REM  Zurück zur alten Version: Inhalt des Backup-Ordners "code" wieder nach
REM  C:\Smartfactoryai kopieren (siehe README, Abschnitt Update).
REM =========================================================================

set "ZIEL=C:\Smartfactoryai"
set "BACKUP_BASIS=C:\Smartfactoryai_Backup"

set "QUELLE=%~dp0"
if "%QUELLE:~-1%"=="\" set "QUELLE=%QUELLE:~0,-1%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%i"
set "BACKUP=%BACKUP_BASIS%\%STAMP%"

echo ===================================================
echo  FactoryAI Shopfloor - Update
echo ===================================================
echo  Neue Version aus : %QUELLE%
echo  Installation     : %ZIEL%
echo  Sicherung nach   : %BACKUP%
echo ===================================================
echo.

REM --- Prüfungen -----------------------------------------------------------
if /I "%QUELLE%"=="%ZIEL%" (
  echo ABBRUCH: Das Skript laeuft im Installationsordner selbst.
  echo Bitte die neue Version in einen eigenen Ordner entpacken und von dort starten.
  goto :fehler
)
if not exist "%ZIEL%\backend\server.js" (
  echo ABBRUCH: Unter %ZIEL% wurde keine Installation gefunden.
  echo Bitte die Variable ZIEL oben in dieser Datei anpassen.
  goto :fehler
)
if not exist "%QUELLE%\backend\server.js" (
  echo ABBRUCH: Im Ordner dieses Skripts liegt keine vollstaendige neue Version.
  goto :fehler
)
where node >nul 2>nul || (echo ABBRUCH: Node.js ist nicht installiert. & goto :fehler)

REM Laeuft der Server noch? (Port 5000 belegt)
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if not errorlevel 1 (
  echo ABBRUCH: Der Shopfloor-Server laeuft noch ^(Port 5000 ist belegt^).
  echo Im PowerShell-Fenster des Servers Ctrl+C druecken oder das Fenster schliessen,
  echo dann dieses Skript erneut starten.
  goto :fehler
)

echo Server ist beendet. Update starten?
pause

REM --- 1. Sicherung ------------------------------------------------------------
echo.
echo [1/3] Sichere bisherige Installation und Daten ...
robocopy "%ZIEL%" "%BACKUP%\code" /E /XD node_modules dist /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (echo ABBRUCH: Sicherung fehlgeschlagen. & goto :fehler)

if exist "%ZIEL%\backend\shopfloor_data\shopfloor_storage.json" (
  if not exist "%BACKUP%\code\backend\shopfloor_data\shopfloor_storage.json" (
    echo ABBRUCH: Datendatei wurde nicht gesichert. Es wurde nichts veraendert.
    goto :fehler
  )
)
echo       OK: %BACKUP%\code

REM --- 2. Neuen Code kopieren (Daten und .env bleiben unberuehrt) ----------------
echo.
echo [2/3] Kopiere neue Version ...
robocopy "%QUELLE%" "%ZIEL%" /E /XD node_modules dist .git shopfloor_data /XF .env /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (echo ABBRUCH: Kopieren fehlgeschlagen. Sicherung liegt unter %BACKUP%. & goto :fehler)
echo       OK

REM --- 3. Pakete installieren und Frontend bauen ----------------------------------
echo.
echo [3/3] Installiere Pakete und baue Frontend ...
cd /d "%ZIEL%\backend"
call npm install --omit=dev
if errorlevel 1 (echo ABBRUCH: npm install im Backend fehlgeschlagen. & goto :fehler)

cd /d "%ZIEL%\frontend"
call npm install
if errorlevel 1 (echo ABBRUCH: npm install im Frontend fehlgeschlagen. & goto :fehler)
call npm run build
if errorlevel 1 (echo ABBRUCH: Frontend-Build fehlgeschlagen. & goto :fehler)

echo.
echo ===================================================
echo  Update abgeschlossen.
echo  Jetzt den Server wieder starten (wie bisher in PowerShell
echo  oder mit starten.bat).
echo  Beim ersten Start legt der Server zusaetzlich eine
echo  Sicherung der Datendatei an und wandelt sie um.
echo  Sicherung dieses Updates: %BACKUP%
echo ===================================================
pause
exit /b 0

:fehler
echo.
echo Update NICHT abgeschlossen. Bestehende Daten sind unveraendert.
pause
exit /b 1
