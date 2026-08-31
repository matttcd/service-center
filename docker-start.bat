@echo off
title Service Center - Docker
cd /d "%~dp0"

REM Arranca Docker en WSL2
echo Arrancando Docker en WSL2...
wsl -u root service docker start >nul 2>&1
timeout /t 2 /nobreak >nul

REM Detecta la IP de Windows desde WSL (solo la primera IP)
for /f %%i in ('wsl hostname -I') do set "WIN_IP=%%i"
echo IP de Windows detectada: %WIN_IP%

REM Levanta Docker Compose con la IP de Windows como PRINT_BRIDGE_HOST
echo Levantando sistema con Docker...
wsl -e bash -c "PRINT_BRIDGE_HOST=%WIN_IP% docker compose up --build"
echo.
echo Si ves esto, Docker se detuvo o hubo un error.
pause
