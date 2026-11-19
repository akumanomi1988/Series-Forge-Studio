@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Instala Node.js 22 o superior desde https://nodejs.org/
  pause
  exit /b 1
)
echo Abriendo servidor Series Forge en una ventana independiente...
start "Series Forge Studio - Servidor" /D "%~dp0" cmd /k "node src/server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4317"
