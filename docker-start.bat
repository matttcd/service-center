@echo off
title Service Center - Docker
cd /d "%~dp0"

REM Arranca Docker en WSL2
echo Arrancando Docker en WSL2...
wsl -u root service docker start >nul 2>&1

REM Espera 2 segundos a que Docker arranque
timeout /t 2 /nobreak >nul

REM Levanta Docker Compose y mantiene la ventana abierta
echo Levantando sistema con Docker...
wsl docker compose up --build
echo.
echo Si ves esto, Docker se detuvo o hubo un error.
pause
