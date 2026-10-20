# Instalación Windows por local

Cada local conserva su propia base PostgreSQL 16. El programa funciona sin Internet y se usa desde el navegador. Una PC servidora permanece encendida; las demás PC solo necesitan navegador, acceso por red y confiar en su certificado HTTPS.

## Estado y límites de validación

La instalación requiere Windows x64 y permisos administrativos para registrar servicios y el certificado local. Los servicios de aplicación e impresión usan una cuenta sin privilegios administrativos. PostgreSQL usa NetworkService y una cuenta SQL propia sin superusuario.

Las pruebas del paquete se ejecutan con sus propios Node, PostgreSQL, Chromium y ejecutable de impresión, ocultando Node/Python globales del PATH. No reemplazan la aceptación en una PC limpia: arranque como servicio antes de iniciar sesión, reinicio de Windows, drivers físicos y acceso a impresoras compartidas deben comprobarse en el local antes de usar datos empresariales.

El instalador se construye con NSIS, que permite distribuir instaladores comerciales sin costo de licencia. Sus términos están en la [licencia oficial](https://nsis.sourceforge.io/License).

## Instalar y configurar

1. Ejecutar el instalador como administrador. En esta estación se proponen `E:\ServiceCenter` para el programa y `E:\ServiceCenterData` para los datos; en otras PC se pueden elegir sus rutas. Una carpeta de datos existente debe corresponder a esta instalación; no se adoptan carpetas ajenas con archivos.
2. Elegir el nombre del equipo o su IP fija y el puerto HTTPS (443 por defecto). Los puertos internos 4011 y 5436 son exclusivos de loopback y deben estar libres. El instalador no detiene otras aplicaciones para liberarlos.
3. Mantener desactivada «Usar otra cuenta de Windows» para crear `ServiceCenterSvc` automáticamente. Solo para colas compartidas que requieren autenticación, activar la opción e indicar una cuenta existente `EQUIPO\usuario` o `DOMINIO\usuario`, sin permisos de administrador, y su contraseña de Windows. Esta cuenta es distinta del Administrador de la aplicación. La contraseña de Windows se entrega al administrador de servicios y se retira del XML; en una actualización de cuenta personalizada debe ingresarse nuevamente.
4. Elegir la contraseña inicial del administrador de la aplicación. Abrir el acceso creado en Inicio → Service Center.
5. Entrar a Configuración → Impresoras. Seleccionar las colas A4 y etiquetas, configurar el papel, guardar y usar los botones de prueba. Las colas se enumeran con la identidad real del servicio. Las impresoras con IP deben tener su driver y cola instalados por equipo; una cola compartida también requiere acceso de la cuenta elegida.

Las etiquetas PDF se imprimen al 100% y usan milímetros configurables. Las preferencias del driver deben coincidir con el rollo. ZPL es una opción explícita para impresoras compatibles y conserva el diseño anterior. Un trabajo aceptado se muestra como «enviado a la cola», sin asegurar que la impresora haya terminado. Ante un timeout, revisar la cola antes de reimprimir.

No se necesita ejecutar `start_bridge.bat`, instalar Python ni tener Docker para este despliegue.

## HTTPS y otras PC

El instalador inicia Caddy y confía en su CA local en la PC servidora. Publica solo HTTPS en el firewall, perfil Privado y subred local. No abre el router ni cambia el perfil de red de Windows.

Copiar **solo** `public\service-center-root.crt` de la carpeta de datos a cada PC autorizada, mediante un medio de confianza, e importarlo en Entidades de certificación raíz de confianza del equipo. Comprobar su huella con la del servidor. Nunca copiar los archivos privados de `tls\`. Después acceder a `https://NOMBRE-O-IP:PUERTO` usando el nombre/IP elegido en la instalación.

Si cambia la dirección del servidor, ejecutar el instalador para reparar la configuración de HTTPS. Para puertos ocupados, elegir otro puerto HTTPS; los internos requieren revisar la otra aplicación antes de instalar.

## Datos, respaldos y recuperación

La carpeta de datos contiene `postgres\`, `config\service.json`, certificados privados, logs y respaldos. Sus ACL restringen el acceso; la cuenta del servicio solo lee la configuración. Guardar por separado la clave `BACKUP_ENCRYPTION_KEY` de `config\service.json`: sin ella no puede verificarse una copia cifrada.

Las copias automáticas se conservan en `app-data\backups` y se exportan a `backups-exported`. Ambas carpetas predeterminadas siguen en la misma PC: para proteger frente a su pérdida, copiar las exportadas a otro disco/equipo y guardar la clave por separado. Puede configurarse `BACKUP_EXPORT_DIR` en `service.json` con un destino accesible para el servicio y reiniciarlo desde Servicios de Windows.

Para recuperar una copia en otra PC:

1. Instalar una instancia vacía y comprobar su estado.
2. Abrir Inicio → Service Center → Recuperar una copia, con elevación de Windows.
3. Seleccionar la ruta del `.dump`, ingresar la clave del equipo original y confirmar `RESTAURAR`.
4. La herramienta activa mantenimiento, verifica el cifrado, crea una copia del estado previo y restaura en una transacción. Conserva la clave propia del nuevo equipo para las próximas copias.
5. Ingresar con los usuarios/contraseñas de la copia y revisar las impresoras del destino.

La restauración reemplaza los datos y los usuarios. No fusiona instalaciones ni sincroniza sucursales. Conservar también el respaldo previo y su clave correspondiente.

## Actualizar, reparar o desinstalar

El instalador coloca cada entrega en una carpeta versionada e inmutable. Al actualizar una instalación operativa activa mantenimiento y exige un respaldo previo; después detiene la aplicación, conserva claves y configuración, aplica migraciones y comprueba su identidad y salud. Si falla, no marca la instalación lista y conserva el respaldo para recuperar. No promete revertir automáticamente una migración de esquema.

Los registros están en `logs\`, y el progreso de instalación en `installation.json`. Las reparaciones deben usar las mismas rutas y la misma cuenta Windows. PostgreSQL permanece en la misma versión mayor 16; una actualización mayor requerirá un procedimiento separado.

Si una migración impide arrancar la aplicación, la herramienta de recuperación también admite el servicio detenido, con PostgreSQL en ejecución. Restaurar la copia previa con su clave y volver a ejecutar el instalador de la versión conocida. Se mantiene detenido el servidor hasta reparar y comprobar su salud; no se reintenta automáticamente una migración fallida.

Desinstalar retira los servicios, la regla de firewall y los archivos del programa incluidos en sus manifiestos. Conserva base, secretos, respaldos, CA y cuenta Windows para permitir la recuperación. No borra datos empresariales automáticamente.

## Construir y verificar

En una estación Windows x64 con Node de desarrollo (build validado con 24.14.1) y Python **3.14.3 x64**. El helper verifica esa versión y las dependencias fijadas antes de empaquetar; los locales no necesitan instalarlas:

```powershell
npm ci
npm ci --prefix server
python -m venv tools/build-python
tools/build-python/Scripts/python.exe -m pip install -r scripts/windows/requirements-build.txt
```

El build prepara NSIS portátil en `tools/nsis/`, sin instalarlo en Windows. Opcionalmente se puede definir `MAKENSIS_PATH` con la ruta a un compilador existente. Los runtimes y NSIS se descargan desde URLs oficiales fijadas en `installer/windows/runtime-lock.json`; el build verifica sus SHA-256 y no consulta versiones «latest».

```powershell
# Solo preparar el payload para comprobarlo:
npm run build:windows -- --payload-only
npm run test:windows

# Construir el instalador completo:
npm run build:windows
```

El resultado, manifiesto y SHA-256 quedan en `release/`, fuera de Git. `test:windows` usa bases descartables dentro de `tools/`, no registra servicios, no modifica certificados del host y no envía trabajos físicos. El paquete contiene el ejecutable auxiliar y sus DLL; no copiar únicamente `ServiceCenterPrint.exe` sin su carpeta `_internal`.

Mantener también `npm run check`, `python tests/server/print_bridge_test.py` y `python tests/server/windows_print_test.py`. Docker continúa disponible con `PRINT_TRANSPORT=bridge`; Windows nativo usa `PRINT_TRANSPORT=windows`.
