# Service Center 1.2.0 para Windows

Instalador offline construido desde `codex/integracion-ui`. Incluye el diseño integrado de Taller y Recepción, navegación y ajustes unificados, temas claro/oscuro y vista previa PDF con recursos locales. Conserva tablas, filtros, reportes, exportaciones y operaciones existentes.

Se actualizan dependencias compatibles del servidor en el lockfile para corregir los avisos [body-parser GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) y [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), este último incluido en la cadena de Puppeteer. No se cambia de versión mayor de Express ni de Puppeteer. La auditoría npm de dependencias de producción del servidor informó cero vulnerabilidades conocidas al preparar esta entrega; esto no sustituye una auditoría de seguridad de la aplicación.

## Datos y compatibilidad

- Registra la fecha real de aceptación del técnico; asignar un equipo no equivale a aceptarlo.
- Permite rechazar un presupuesto y mantener el equipo pendiente de retiro con un importe explícito, incluso cero. Conserva presupuesto original y seña.
- Aplica la migración aditiva `20261026000000_workspace_ui`. No inventa fechas, cargos ni rechazos históricos.
- No volver a un ejecutable anterior sobre esta base después de usar los estados nuevos. Para recuperar una versión anterior, restaurar su respaldo compatible y su clave mediante el procedimiento de recuperación.

## Actualizar desde 1.1.4

1. Conservar una copia cifrada exportada fuera de la PC y su clave guardada por separado.
2. Cerrar las operaciones en otras PC del local. Ejecutar `ServiceCenter-Setup-1.2.0.exe` como administrador.
3. Comprobar que muestra **Actualizar Service Center: 1.1.4 → 1.2.0**, con las carpetas existentes. Si informa una inconsistencia, detenerse y revisar el diagnóstico.
4. Pulsar **Actualizar**. Se exige un respaldo previo; después se detienen los servicios, se aplican migraciones y se comprueba la salud. Conserva configuración, usuarios, certificados y credenciales de los servicios.
5. Entrar desde el navegador y comprobar las órdenes anteriores, Ajustes, PDF e impresoras. Revisar HTTPS desde otra PC y repetir las pruebas de impresión del local.

Una actualización normal no solicita contraseñas iniciales. Una reparación de una cuenta Windows personalizada puede requerir sus credenciales. Si falla el respaldo, no continuar; si falla una migración, conservar la copia previa y seguir la recuperación de `docs/WINDOWS.md`.

## Archivos y comprobación

El instalador, su archivo `.sha256` y el manifiesto se entregan juntos en `release/`. Comprobar el ejecutable con `Get-FileHash -Algorithm SHA256` y comparar con el archivo recibido por un canal de confianza. El hash comprueba integridad; no sustituye una firma digital del editor.

La generación del paquete no instala ni actualiza esta PC. Las verificaciones utilizan bases descartables, no envían trabajos físicos y no modifican la confianza de certificados de Windows.

Antes de usar datos empresariales siguen siendo necesarias la aceptación en una PC limpia, el arranque tras reiniciar Windows sin iniciar sesión, la impresión física desde la cuenta del servicio y una recuperación en otra PC.
