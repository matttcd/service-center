@echo off
REM ============================================================
REM Levanta el print_bridge.py en la PC Windows.
REM Recibe etiquetas ZPL y PDFs por TCP desde el backend (Docker)
REM y los imprime en la impresora USB conectada a esta PC.
REM
REM Requisitos:
REM   - Python 3 instalado y en el PATH.
REM   - SumatraPDF instalado (solo para imprimir PDFs de la orden).
REM     Descargalo de https://www.sumatrapdfreader.org/download-free-pdf-viewer.html
REM ============================================================
setlocal

set PORT=9200
REM Ajustá esta ruta si SumatraPDF está instalado en otro lugar.
if not defined SUMATRA_PDF set "SUMATRA_PDF=C:\Users\Administrador\AppData\Local\SumatraPDF\SumatraPDF.exe"

if not exist "%SUMATRA_PDF%" (
  echo [ADVERTENCIA] SumatraPDF no se encontró en: %SUMATRA_PDF%
  echo Los PDFs de la orden NO se imprimirán. Instalalo para habilitarlos.
  echo (La impresión de etiquetas ZPL sigue funcionando igual.)
  echo.
)

echo Iniciando print_bridge en el puerto %PORT%...
python server\printer\print_bridge.py --port %PORT%

endlocal
