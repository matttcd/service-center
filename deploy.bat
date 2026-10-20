@echo off
cd /d "%~dp0"
node scripts/deploy.mjs
if errorlevel 1 echo [ERROR] El sistema no se desplego. Revisa el mensaje anterior.
pause
