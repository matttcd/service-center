# Service Center 1.2.1 para Windows

Instalador offline completo desde `codex/integracion-ui`, con actualización selectiva y las correcciones del flujo posteriores a 1.2.0. No agrega migraciones nuevas; conserva las de 1.2.0 para instalaciones anteriores.

## Actualización sin extraer todo

- Compara los archivos existentes con SHA-256 y tamaño. Reutiliza los idénticos y extrae solo los nuevos o modificados.
- En NTFS comparte los archivos inmutables mediante enlaces físicos; si no es posible, utiliza copias. Conserva la versión anterior.
- Verifica todos los archivos antes de ejecutar componentes del paquete. Una extracción interrumpida permite reintentar; un archivo anterior alterado no se reutiliza.
- Mantiene respaldo cifrado obligatorio, carpetas, datos, certificados, impresoras y credenciales. Un fallo de respaldo impide modificar servicios y configuración.
- El `.exe` sigue siendo completo para instalar sin Internet en otra PC. La mejora reduce extracción y duplicación de archivos, no el tamaño de una descarga diferencial.

## Cambios de la aplicación

- Colas sin selección automática y ficha que se cierra al cambiar el estado, conservando borradores y confirmaciones de entrega.
- Retiro con/sin orden y cliente/tercero en el mismo formulario; asignación de técnico con confirmación explícita.
- Acciones separadas por perfil y finalización técnica sin abrir impresión automáticamente.
- DNI con puntos para lectura, trabajos frecuentes y entrada manual, ajustes reunidos y espacios consistentes.
- Títulos de página de 18 px y encabezado del buscador de 84 px, estable con cola vacía o con equipos.
- Carga, errores y caché de los listados; aviso guardado separado de errores posteriores de sincronización.
- PDF con primera página progresiva y reutilización temporal por sesión, invalidada al cambiar datos. Recursos locales y bloqueo de accesos externos conservados.

Ver el detalle de estas correcciones en [UI-POLISH.md](UI-POLISH.md).

## Instrucciones de actualización

1. Conservar un respaldo cifrado exportado fuera de la PC y su clave por separado. Finalizar las operaciones abiertas del local.
2. Ejecutar **ServiceCenter-Setup-1.2.1.exe** solo en la PC servidora y aceptar el permiso administrativo de Windows.
3. Comprobar versión actual → 1.2.1 y las carpetas detectadas. Pulsar **Actualizar**; no desinstalar ni extraer archivos manualmente.
4. Esperar la reutilización/extracción, verificación, respaldo y reinicio de los servicios. No interrumpir el instalador ni apagar la PC.
5. Abrir la misma URL HTTPS y revisar órdenes, Ajustes, PDF e impresoras. Las otras PC siguen entrando por su navegador, sin instalador adicional.

Una actualización normal no vuelve a pedir contraseñas. Una reparación de cuenta Windows personalizada puede requerirlas. Si falla la verificación, no se ejecutan los componentes nuevos; si falla el respaldo, no se cambia la instalación. Ante fallos de migración, conservar el respaldo y seguir [WINDOWS.md](WINDOWS.md). No promete reversión automática de la base.

No modificar manualmente `versions\`: los archivos idénticos pueden estar compartidos entre entregas. La comprobación de hashes puede tomar tiempo y depende del disco y antivirus.

## Archivos y límites

El ejecutable, su SHA-256, manifiesto e informe de verificación se entregan en `release/`. Comparar el hash por un canal de confianza; no sustituye una firma digital del editor.

El empaquetado y las pruebas usan entornos descartables. No ejecutan el instalador principal ni actualizan esta instalación Windows. Siguen pendientes la aceptación en una PC limpia sin Internet, reinicio sin iniciar sesión, impresoras físicas y recuperación en otra PC.
