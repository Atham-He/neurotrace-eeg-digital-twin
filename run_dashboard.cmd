@echo off
set "DASHBOARD_ROOT=%~dp0"
set "DASHBOARD_PORT=4173"
start "NeuroScope Server" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\serve-dashboard.ps1" -Root "%DASHBOARD_ROOT%" -Port %DASHBOARD_PORT%
timeout /t 1 /nobreak >nul
start "NeuroScope" "http://127.0.0.1:%DASHBOARD_PORT%/"
