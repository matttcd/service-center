@echo off
title El Gringo Celulares - Respaldo de datos de produccion
cd /d "%~dp0"
echo Copiando la base de produccion al archivo local server\data\db.json ...
docker cp service-center-backend:/app/data/db.json "server\data\db.json"
echo Listo. Base respaldada fuera del volumen de Docker.
echo Ojo: no lo corras mientras el backend de desarrollo (:3001) este en uso.
pause