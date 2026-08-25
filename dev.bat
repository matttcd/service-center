@echo off
title El Gringo Celulares - Entorno de desarrollo
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias del frontend...
  call npm install
)
if not exist "server\node_modules" (
  echo Instalando dependencias del backend...
  pushd server
  call npm install
  popd
)

echo.
echo Levantando backend de desarrollo en :4000 (usa server\data\db.json)
start "Service Center API dev :4000" cmd /k "%~dp0dev-api.bat"
echo Levantando frontend de desarrollo en http://localhost:5173
start "Cuotas Front dev :5173" cmd /k "%~dp0dev-front.bat"
echo.
echo Probá en http://localhost:5173 - NO toca produccion (:8080).
echo Cerrá las dos ventanas cmd para detener el entorno de desarrollo.
pause