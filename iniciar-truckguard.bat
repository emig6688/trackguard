@echo off
title TruckGuard
cd /d "%~dp0"
echo Iniciando TruckGuard...
start "TruckGuard - Servidor (no cerrar)" cmd /k "npm run dev"
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000"
