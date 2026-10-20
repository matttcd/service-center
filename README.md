# El Gringo Celulares

Gestión de órdenes de servicio para equipos electrónicos. React en el navegador, API Express, PostgreSQL 16 y Prisma 6. El historial de órdenes, clientes, técnicos y permisos ya está implementado; no hace falta reemplazar la arquitectura para completar el producto.

La evaluación del código y los pasos pendientes están en [docs/REVISION.md](docs/REVISION.md).

## Estado de verificación

Verificado con PostgreSQL 16 real y Chrome: alta de clientes y órdenes, roles, presupuestos, reparaciones, derivación externa, entrega, garantía, comprobantes PDF, CSV de varias páginas, papelera, cambio de contraseña y recuperación desde un respaldo cifrado. También se probó adoptar una base anterior creada con `db push` conservando sus datos. Las pruebas usan bases descartables y secretos nuevos.

El despliegue completo en Docker, HTTPS desde otros dispositivos y la impresora física siguen pendientes: WSL presentó un error de entrada/salida cuyo arreglo se pospuso. No incorporar datos empresariales hasta validar esos puntos y una copia fuera de la PC. Evidencia y límites en [docs/REVISION.md](docs/REVISION.md).

## Preparar y desplegar

Requisitos: Node.js 22.12 o posterior y Docker con Compose v2. Puede usarse Docker Desktop o Docker Engine dentro de WSL. El motor debe estar iniciado antes de ejecutar los scripts.

```powershell
npm ci
npm ci --prefix server
npm run setup:env
npm run check
npm run deploy
```

También se puede usar `docker-start.bat` o `deploy.bat`. Estos scripts utilizan Docker nativo si está instalado y recurren a WSL si no encuentran el ejecutable. No actualizan Git automáticamente: revisar y actualizar el código es un paso separado.

El despliegue valida la configuración; si encuentra un backend activo, crea y exporta un respaldo antes de construir; luego espera las comprobaciones de salud. Un error detiene el procedimiento. Las imágenes se construyen antes de reemplazar los contenedores existentes. No hay rollback automático de código ni de esquema.

Acceso inicial: `http://localhost:8081`, perfil Administrador, contraseña `admin123`. El sistema obliga a cambiarla antes de acceder a los datos. También puede definirse `INITIAL_ADMIN_PASSWORD` antes del primer arranque de una base vacía. Las contraseñas nuevas requieren 8 caracteres como mínimo y un máximo de 72 bytes.

`setup:env` crea los secretos ausentes sin mostrarlos. Reemplaza un JWT_SECRET anterior de menos de 32 caracteres; esto invalida las sesiones anteriores. No reemplaza una clave de cifrado existente. El `.env` queda fuera de Git y del contexto de Docker. Guardar una copia segura de ese archivo fuera de la PC: perder `BACKUP_ENCRYPTION_KEY` impide descifrar los respaldos nuevos.

## Red y HTTPS

La configuración inicial publica la web y PostgreSQL solamente en `127.0.0.1`; la API queda dentro de Docker. PostgreSQL usa `PG_PORT` (5432 por defecto) y la web `APP_PORT` (8081). No abrir esos puertos del router hacia Internet.

Para usar varios equipos con datos reales, está preparado un perfil HTTPS local con Caddy. Su validación en el entorno real está pendiente. Ejemplo para una PC con IP fija `192.168.1.50`, agregar al `.env`:

```env
ENABLE_HTTPS=1
APP_HOST=192.168.1.50
HTTPS_BIND_IP=0.0.0.0
```

Ejecutar `npm run deploy` y acceder a `https://192.168.1.50`. Caddy usa una autoridad certificadora local: exportar su certificado público e instalarlo como raíz de confianza en cada dispositivo autorizado. **No distribuir la clave privada ni el contenido completo del volumen TLS.**

```powershell
docker compose cp gateway:/data/caddy/pki/authorities/local/root.crt ./service-center-root.crt
```

Si se usa únicamente WSL, el comando equivalente empieza con `wsl --cd . --exec docker`. Permitir el puerto 443 solo en redes privadas en el Firewall de Windows. Mantener `APP_BIND_IP=127.0.0.1` para que el HTTP de 8081 continúe siendo local. Configurar `APP_BIND_IP=0.0.0.0` habilita HTTP en la LAN y transmite los datos sin cifrar; reservarlo para pruebas sin información real.

Referencia: [red de Docker Desktop](https://docs.docker.com/desktop/features/networking/) y [dependencias con comprobaciones de salud](https://docs.docker.com/compose/how-tos/startup-order/).

## Base de datos y migraciones

Los datos viven en el volumen `service-center_pgdata`. Los respaldos viven en `service-center_data`. No ejecutar `docker compose down -v` sobre producción.

El arranque usa `prisma migrate deploy`, con una migración inicial versionada. Si encuentra una base anterior creada con `db push`, solo adopta esa base cuando su estructura coincide con el esquema esperado. Si hay diferencias, se detiene para revisarlas; no ejecuta reset ni acepta pérdida de datos. Se verificó esta adopción sobre una base descartable; antes de actualizar una instalación existente, repetirla con una copia de esa base. Un volumen de respaldos creado por una versión que corría como root también requiere revisar sus permisos para el usuario 1000 del backend actual.

Para futuros cambios: crear y revisar migraciones en una base de desarrollo; no usar `prisma db push --accept-data-loss` en producción. Si se agregan migraciones después de la inicial, revisar también la lógica de adopción de bases antiguas de `server/start-production.js`.

## Respaldos y recuperación

En producción las copias nuevas se cifran con AES-256-GCM y `BACKUP_ENCRYPTION_KEY`. Se crea una al arrancar y otra a las 03:00 de Argentina; se conservan 30 por defecto (`MAX_BACKUPS`). La interfaz de administrador permite crear, descargar y restaurar copias.

```powershell
npm run backup
# O doble clic en backup-datos.bat
```

Las copias automáticas también se exportan a `backups/` en el host; el comando manual crea y exporta otra copia. `BACKUP_HOST_DIR` permite elegir otro destino montado en Docker. Se conservan 90 exportadas por defecto (`MAX_EXPORTED_BACKUPS` en el backend). El panel muestra la última copia y los errores de exportación.

La carpeta predeterminada sigue estando en esta PC: configurar otro disco o un destino externo y verificar su disponibilidad y permisos. Las copias del mismo equipo no protegen ante su pérdida. Conservar la clave de cifrado por separado.

Para restaurar, colocar un archivo `db-<marca-de-tiempo>.dump` exportado en `backups/` y ejecutar `restore-datos.bat`. Solicita seleccionar la copia y escribir `RESTAURAR`. Las copias también pueden restaurarse desde el panel de administrador.

El sistema verifica y descifra la copia antes de invocar PostgreSQL, exige un respaldo previo del estado actual y usa una única transacción para la restauración. También admite leer copias antiguas sin cifrar creadas con pg_dump; mantenerlas protegidas o retirarlas después de verificar una copia cifrada nueva. La restauración requiere una ventana de mantenimiento sin otros usuarios trabajando.

Límite actual: el respaldo comprimido se procesa en memoria y tiene un máximo de 256 MiB. Si la base se acerca a ese tamaño, pasar a procesamiento por streams antes de ampliar el límite. Una prueba real de restauración en otra base es requisito previo a producción y debe repetirse periódicamente.

El cifrado de las copias no cifra el volumen de PostgreSQL: los PIN de dispositivos y demás datos siguen almacenados en la base. Proteger el disco con BitLocker u otro cifrado del sistema y restringir las cuentas Windows y los accesos administrativos a Docker.

## Impresión

El backend genera PDF con Chromium dentro de Docker y envía etiquetas ZPL o PDF al puente Python de Windows. El puente exige `PRINT_BRIDGE_TOKEN`, compartido mediante el `.env`, antes de consultar o imprimir. No publica un servicio HTTP.

Requisitos del host: Python 3, `pywin32`, impresoras instaladas y SumatraPDF para PDF. Puede indicarse su ruta con `SUMATRA_PDF` en `.env` o en el entorno. Para etiquetas, definir `LABEL_PRINTER_NAME` con el nombre exacto de una impresora compatible con ZPL; sin esa variable se detectan nombres Zebra/Godex conocidos. Las etiquetas no se envían a una impresora de oficina por defecto. Ejecutar `start_bridge.bat` desde la PC conectada a las impresoras.

La opción «Abrir PDF para imprimir» permite imprimir o guardar desde el visor del navegador sin tener el puente activo. Solo la impresión directa y las etiquetas requieren el puente.

En Docker Desktop, `PRINT_BRIDGE_HOST=host.docker.internal`. En Docker Engine instalado directamente dentro de WSL, configurar explícitamente la IP de Windows accesible desde WSL: `host-gateway` identifica al host Linux y puede no ser Windows. El código respeta `PRINT_BRIDGE_HOST` tanto para etiquetas como para PDF. Restringir el puerto 9200 del firewall al origen necesario para Docker.

Las pruebas del puente verifican autenticación y protocolo sin enviar trabajos a impresoras reales.

## Desarrollo

Usar una base separada de producción. Definir un `DATABASE_URL` de desarrollo en `server/.env` o en el entorno del proceso; el `.env` raíz tiene precedencia si también define esa variable. No reutilizar las credenciales ni los datos de producción.

```powershell
node server/node_modules/prisma/build/index.js generate --schema server/prisma/schema.prisma
# En una base de desarrollo vacía y previamente configurada:
cd server
npx prisma migrate deploy
cd ..
npm run dev:server
# En otra terminal:
npm run dev
```

Frontend: `http://localhost:5173`. API de desarrollo: `http://localhost:4000`; Vite redirige `/api` a ese puerto. `reset-dev-datos.bat` es destructivo: usar exclusivamente contra una base descartable y revisar su DATABASE_URL antes de ejecutarlo.

## Verificación

```powershell
npm run check
python tests/server/print_bridge_test.py
npm audit
npm audit --prefix server
```

La suite de Vitest incluye peticiones HTTP con persistencia simulada. Para probar contra PostgreSQL 16 real sin Docker:

```powershell
# Cliente PostgreSQL 16: carpeta que contiene pg_dump y pg_restore
$env:PG_BIN_DIR = 'E:\herramientas\pgsql\bin'
npm run test:local
# Agrega Chrome/Edge instalado para verificar las pantallas:
npm run test:browser
```

En esta estación ya hay herramientas en `tools/pgsql/bin`, ruta predeterminada de las pruebas Windows. No se incluyen en Git. En otra estación, instalar las herramientas oficiales de PostgreSQL 16 y definir `PG_BIN_DIR`. El paquete de desarrollo `embedded-postgres` proporciona el servidor temporal. Los scripts ocupan solo `127.0.0.1:8181`, crean una base y secretos nuevos, verifican migraciones, flujos y restauración, y eliminan sus datos al finalizar. Las capturas y PDF quedan en `test-results/`, fuera de Git.

Alternativamente, usar exclusivamente este proyecto Docker separado, sin nombres ni volúmenes de producción:

```powershell
docker compose -p service-center-verify -f docker-compose.verify.yml up -d --build --wait --wait-timeout 240
npm run test:integration
docker compose -p service-center-verify -f docker-compose.verify.yml down
```

El entorno de verificación usa almacenamiento temporal: sus datos se descartan. La prueba recorre roles, cambio inicial de contraseña, recepción, revisión, presupuestos, repuestos, entrega, garantía, derivación externa, numeración concurrente, PDF y restauración cifrada. Solo admite `localhost:8181` o `127.0.0.1:8181`, para reducir el riesgo de ejecutarla sobre producción. Incluida además en `.github/workflows/check.yml`.
