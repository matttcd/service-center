@echo off
title El Gringo Celulares - Respaldo de Base de Datos PostgreSQL
cd /d "%~dp0"

echo ============================================================
echo   El Gringo Celulares - Respaldo de PostgreSQL (Docker)
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
  echo Inicia el sistema con docker compose up -d antes de respaldar.
  echo.
  pause
  exit /b 1
)

REM 2. Preparar carpeta de backups
set "BACKUP_DIR=%~dp0backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM 3. Obtener fecha y hora en formato estandar YYYY-MM-DD_HH-mm-ss
for /f %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TIMESTAMP=%%a"
set "BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.dump"

echo Creando copia de seguridad en:
echo   %BACKUP_FILE%
echo.

REM 4. Ejecutar pg_dump sin TTY (-t) para no alterar bytes binarios
docker exec service-center-db pg_dump -U service_center -d service_center -Fc > "%BACKUP_FILE%"

if errorlevel 1 (
  echo [ERROR] Hubo un problema al generar la copia de seguridad.
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
  echo.
  pause
  exit /b 1
)

REM Verificar que el archivo no haya quedado vacio
for %%A in ("%BACKUP_FILE%") do set "FILE_SIZE=%%~zA"
if "%FILE_SIZE%"=="0" (
  echo [ERROR] El archivo de respaldo se genero vacio.
  del "%BACKUP_FILE%"
  echo.
  pause
  exit /b 1
)

echo [OK] Copia de seguridad creada con exito (%FILE_SIZE% bytes).
echo.
pause