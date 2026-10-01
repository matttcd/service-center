@echo off
setlocal EnableDelayedExpansion
title El Gringo Celulares - Restaurar Base de Datos PostgreSQL
cd /d "%~dp0"

echo ============================================================
echo   El Gringo Celulares - Restaurar PostgreSQL (Docker)
echo ============================================================
echo.

REM 1. Verificar si Docker esta activo y el contenedor de postgres existe
docker ps -q -f name=service-center-db > nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta respondiendo. Verifica que Docker Desktop este abierto.
  echo.
  pause
  exit /b 1
)

for /f %%i in ('docker ps -q -f name=service-center-db') do set "CONTAINER_ID=%%i"
if "%CONTAINER_ID%"=="" (
  echo [ERROR] El contenedor 'service-center-db' no esta en ejecucion.
  echo Inicia el sistema con docker compose up -d antes de restaurar.
  echo.
  pause
  exit /b 1
)

set "BACKUP_DIR=%~dp0backups"
if not exist "%BACKUP_DIR%" (
  echo [ERROR] No existe la carpeta 'backups\'. Realiza una copia primero.
  echo.
  pause
  exit /b 1
)

REM 2. Listar archivos de respaldo disponibles
set count=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\*.dump" 2^>nul') do (
  set /a count+=1
  set "file_!count!=%%F"
  echo [!count!] %%F
)

if %count%==0 (
  echo [AVISO] No se encontraron archivos .dump en %BACKUP_DIR%.
  echo.
  pause
  exit /b 1
)

echo.
set /p "SELECTION=Ingresa el numero del respaldo a restaurar (1-%count%) o ENTER para cancelar: "
if "%SELECTION%"=="" (
  echo Operacion cancelada.
  echo.
  pause
  exit /b 0
)

set "TARGET_FILE=!file_%SELECTION%!"
if "%TARGET_FILE%"=="" (
  echo [ERROR] Seleccion invalida.
  echo.
  pause
  exit /b 1
)

set "FULL_PATH=%BACKUP_DIR%\%TARGET_FILE%"
echo.
echo ============================================================
echo [ADVERTENCIA]
echo Se restaurara el archivo:
echo   %TARGET_FILE%
echo.
echo Esto SOBREESCRIBIRA los datos actuales de produccion.
echo ============================================================
set /p "CONFIRM=Estas completamente seguro? Escribe 'SI' para confirmar: "
if not "%CONFIRM%"=="SI" (
  echo Operacion cancelada por el usuario.
  echo.
  pause
  exit /b 0
)

echo.
echo Restaurando base de datos en PostgreSQL...
docker exec -i service-center-db pg_restore -U service_center -d service_center --clean --if-exists < "%FULL_PATH%"

if errorlevel 1 (
  echo [AVISO] pg_restore finalizo con advertencias o notas (habitual en esquemas con drop table previo).
) else (
  echo [OK] Base de datos restaurada correctamente.
)

echo.
echo Se recomienda reiniciar el backend para refrescar caches:
echo   docker compose restart backend
echo.
pause
