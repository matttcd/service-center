@echo off
title Service Center - Docker

REM Arranca Docker en WSL2 (pide clave la primera vez si no configuraste NOPASSWD)
wsl -u root service docker start >nul 2>&1

REM Sube todo con Docker Compose
echo Levantando sistema con Docker...
wsl docker compose up --build
