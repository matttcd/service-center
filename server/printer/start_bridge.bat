@echo off
REM ============================================
REM Print Bridge: inicia el servidor TCP para impresión
REM Colocar en tarea programada "Al iniciar sesión"
REM ============================================
cd /d "%~dp0"
python print_bridge.py --port 9200
pause
