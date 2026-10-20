# Componentes incluidos

Este paquete conserva los avisos de licencia de Node.js, PostgreSQL, Chromium y Caddy junto a sus binarios. Los módulos npm conservan sus archivos de licencia en server/node_modules. El runtime de impresión contiene Python, pywin32 y su información de distribución.

- Node.js: https://nodejs.org/ · licencia y avisos en runtime/node/LICENSE.
- PostgreSQL 16: https://www.postgresql.org/ · licencia y avisos de componentes en runtime/pgsql/.
- Chrome for Testing (headless shell): https://googlechromelabs.github.io/chrome-for-testing/ · avisos incluidos en runtime/chromium/.
- Caddy: https://github.com/caddyserver/caddy · Apache-2.0, runtime/caddy/LICENSE.
- WinSW: https://github.com/winsw/winsw · MIT; fuente de la versión usada: https://github.com/winsw/winsw/tree/v2.12.0.
- SumatraPDF: https://www.sumatrapdfreader.org/ · fuente correspondiente: https://github.com/sumatrapdfreader/sumatrapdf/tree/3.6.1rel. Conservar sus términos de redistribución junto al instalador.
- Python: https://www.python.org/ · PSF License; pywin32: https://github.com/mhammond/pywin32.
- Microsoft Visual C++ Redistributable x64: paquete original firmado por Microsoft, incluido para PostgreSQL; https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist/.

Las versiones y SHA-256 exactos están en runtime-lock.json y en el manifiesto de cada entrega. NSIS (https://nsis.sourceforge.io/License) y PyInstaller se usan para construir el paquete; no se instalan como herramientas de desarrollo en los locales.
