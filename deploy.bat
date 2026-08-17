@echo off
title El Gringo Celulares - Deploy a produccion
cd /d "%~dp0"

echo [1/3] Actualizando codigo desde git...
git pull

echo [2/3] Reconstruyendo imagenes y reiniciando contenedores...
docker compose up -d --build

echo [3/3] Estado de los contenedores:
docker ps --filter "name=cuotas-"
echo.
echo Produccion en http://localhost:8080 - los datos del volumen NO se tocan.
pause