@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Debes instalar Node.js 22+ & pause & exit /b 1)
if not exist node_modules\three (echo Instalando dependencias... & call npm install || (pause & exit /b 1))
start "" http://127.0.0.1:4317
call npm start
pause