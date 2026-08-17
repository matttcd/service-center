@echo off
title El Gringo Celulares - Resetear datos de desarrollo
cd /d "%~dp0"

if exist "server\data\db.json" (
  move /y "server\data\db.json" "server\data\db.respaldo.json" >nul
  echo Base de desarrollo guardada como server\data\db.respaldo.json
)
echo Base de desarrollo restablecida: se genera con datos de ejemplo al iniciar.
pause