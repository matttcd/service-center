@echo off
title El Gringo Celulares - Resetear Base de Datos de Desarrollo
cd /d "%~dp0"

echo ============================================================
echo   El Gringo Celulares - Resetear Base de Desarrollo
echo ============================================================
echo.
echo Esta accion borrara y recreara todas las tablas de la base
echo de datos local de desarrollo segun DATABASE_URL de server\.env.
echo.
set /p "CONFIRM=Deseas continuar? Escribe 'SI' para confirmar: "
if not "%CONFIRM%"=="SI" (
  echo Operacion cancelada por el usuario.
  echo.
  pause
  exit /b 0
)

echo.
echo [1/2] Reiniciando esquema de base de datos con Prisma...
cd server
call npx prisma db push --force-reset
if errorlevel 1 (
  echo [ERROR] No se pudo reiniciar la base de datos. Verifica que PostgreSQL este activo y DATABASE_URL sea correcta.
  cd ..
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Sembrando usuario admin y catalogo inicial...
call npx prisma generate
node -e "import('./seed.js').then(m => m.seedIfEmpty()).then(() => { console.log('Base de datos inicializada con usuario admin y catalogo.'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })"
cd ..

echo.
echo [OK] Base de datos de desarrollo restablecida con exito.
echo Credenciales por defecto: admin@local.com / admin123
echo.
pause