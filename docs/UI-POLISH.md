# Correcciones del flujo y presentación

Rama: `codex/integracion-ui`. Esta entrega modifica el código del sistema real; no actualiza la instalación Windows, no genera un instalador y no cambia el esquema de la base.

## Comportamiento

- Taller y Recepción abren sin selección. Cambiar de pestaña limpia la ficha; cambiar un estado o salir del pendiente también la cierra, sin seleccionar otra orden. Los borradores permanecen en memoria.
- El buscador y el inicio de la cola conservan su posición, incluso con nombres largos. Se igualan los espacios de Taller y Recepción y se reserva altura para las acciones.
- El contenedor del buscador mantiene 84 px también sin resultados; los títulos de las páginas usan 18 px, incluidos sus estados de carga.
- El retiro reúne Con orden / Sin orden y Cliente / Tercero. La constancia y la confirmación siguen disponibles aunque el equipo salga de la cola. Sin comprobante y retiro anticipado conservan sus reglas independientes.
- La asignación del técnico requiere Guardar. Recepción y técnicos tienen acciones propias; finalizar una reparación no abre la impresión al técnico.
- Notas generales incorpora su icono. El trabajo mantiene edición libre y ofrece seis opciones frecuentes, selección múltiple y Otro. Se elimina el botón de descarte del alta; cerrar conserva el borrador.
- DNI con puntos para lectura, edición y PDF; almacenamiento, peticiones y exportaciones mantienen los dígitos. Las búsquedas admiten ambos formatos.
- Ajustes reúne la cuenta y las seis secciones administrativas originales. Estas últimas siguen restringidas a administración. Configuración conserva sus enlaces mediante redirección. Se elimina Resumen y administración inicia en Recepción.
- Órdenes, Terminados e historial del cliente reutilizan páginas en memoria por sesión y filtros mientras revalidan. Los errores no se convierten en resultados vacíos; las respuestas atrasadas y las sesiones anteriores no reemplazan la vista actual. Se corrigen también los estados iniciales y de error de auditoría y respaldos.
- Un guardado confirmado se separa de su sincronización. Si esta falla, se informa «Pendiente de sincronizar», sin marcar el guardado como fallido. Los dobles clics no duplican el aviso.

## PDF

Se mantiene Chromium compartido y el bloqueo de recursos externos. El documento embebido espera su carga y las fuentes, sin la pausa de inactividad de red. La vista muestra la primera página mientras continúa con las siguientes.

El navegador conserva hasta tres comprobantes en memoria de la sesión, identificados por los datos impresos, cliente y términos. Reabrir no genera otro PDF; cambiar esos datos invalida su reutilización. Los enlaces temporales se revocan al cerrar y la memoria de la sesión se elimina al salir o cambiar de perfil.

Medición local con el mismo comprobante ficticio, cuatro generaciones:

| Medida | Antes | Después |
|---|---:|---:|
| Primera generación, Chromium frío | 4.450 ms | 3.271 ms |
| Promedio de las tres siguientes | 1.808 ms | 1.050 ms |

En navegador se midieron por separado generación (`Server-Timing`), descarga y primera página. Una reapertura desde memoria evitó la petición y midió menos de 1 ms para recuperar el PDF; dibujar su primera página tomó unos 436 ms. Son mediciones de esta PC, no límites garantizados.

## Verificación

### Usuarios, diagnóstico y notas

- El alta devuelve únicamente los datos públicos del usuario y los incorpora de inmediato a la tabla y a técnicos disponibles. El formulario espera la confirmación del alta; la sincronización general continúa en segundo plano. La contraseña conserva su costo de hash y se calcula de forma asíncrona.
- El selector de perfiles consulta los perfiles al abrirse; administración usa además los usuarios ya sincronizados. Se descartan respuestas antiguas del selector y de consultas previas a un guardado confirmado.
- Diagnóstico y trabajo se editan en una ventana, usando el campo original `fix`. Cerrar conserva el borrador. El pie mantiene su acción durante la edición; una revisión sin trabajo ofrece «Registrar diagnóstico» y, después de guardar, «Enviar a recepción».
- Las notas muestran el formulario primero y el historial con autor, fecha y controles accesibles debajo. Se mantienen los borradores y valores ante errores; los envíos duplicados se bloquean.
- La impresión de órdenes, etiquetas y constancias queda restringida a recepción y administración en la interfaz y en la API.
- El técnico distingue «Pendiente de presupuesto», «Presupuesto listo para avisar» y «Pendiente de aprobación». Precio, aviso y aprobación se verifican entre sesiones mediante el canal real de eventos.
- Las confirmaciones del trabajo y del cambio de perfil usan ventanas de la aplicación, sin `window.confirm`.

`tests/integration/technician-browser.mjs` comprueba el alta con bootstrap bloqueado, el perfil disponible sin recargar, la edición en ventana, conservación de notas ante un fallo, bloqueo de duplicados, permisos de impresión y sincronización del presupuesto. Usa exclusivamente servidores locales con marcador de verificación y datos ficticios.

La respuesta del cliente y las demás operaciones que devuelven la orden guardada actualizan la ficha inmediatamente después de esa confirmación; la recarga general continúa en segundo plano. `response-browser.mjs` comprueba aprobación, rechazo, errores que conservan valores y doble envío. Con una recarga demorada artificialmente 3 segundos, en esta PC la interfaz pasó de 3.249/3.163 ms a 157/283 ms (aprobación/rechazo). No son tiempos garantizados del servidor ni de otras PC. La prueba reutiliza perfiles y envía sus órdenes a la papelera al terminar.

En Taller, iniciar revisión, iniciar reparación y retomar mantienen la ficha. Tomar un equipo propio de «Sin asignar» abre «Mis trabajos» sin cerrar el equipo. Pasar a presupuesto, esperar repuestos, terminar o perder la asignación cierra la ficha; no selecciona el siguiente equipo. La referencia de selección se actualiza al continuar, para que volver posteriormente a presupuesto también la cierre. Recepción conserva el cierre al resolver su pendiente y los errores conservan la ficha y los borradores.

Los modales comparten tamaño según contenido, márgenes para zonas seguras, encabezado fijo y cuerpo desplazable. El alto responde al viewport visual al abrir el teclado; los campos móviles usan 16 px y los controles principales tienen al menos 44 px de alto. Los selectores anidados conservan el foco y lo devuelven al botón al cerrar, incluso con `autoFocus`. En móvil, una sola acción acompaña al título; varias acciones pasan a su propia fila. Las pestañas mantienen texto completo en una fila desplazable y el seleccionado queda visible al navegar con teclado.

`mobile-browser.mjs` recorre las páginas principales y 16 ventanas reales, incluyendo cambio de perfil, presupuesto, nueva orden, retiro por terceros, impresión y trabajo. Verifica límites, desplazamiento interno, foco, ventanas anidadas y borradores en ambos temas, retrato/paisaje y altura reducida. Las capturas `movil-*.png` están en `test-results/integracion-ui/`. La prueba reutiliza perfiles y no imprime ni confirma cambios de cuentas o recuperaciones. Falta la comprobación del teclado y las zonas seguras en dispositivos físicos iOS/Android.

Las tablas de Órdenes y Terminados conservan sus resultados mientras revalidan, sin insertar una fila «Actualizando». La caché mantiene hasta 20 consultas como referencia temporal, siempre las revalida y se limpia al cambiar de sesión. La carga inicial y los errores siguen diferenciados; Papelera y Copias tampoco sustituyen su contenido al recargar.

Las notas se presentan como mensajes, agrupando solo entradas consecutivas del mismo autor y minuto. La ventana mantiene altura estable y desplaza el historial; agregar mensajes no la agranda. Conserva edición, eliminación, borradores y permisos. Al recibir notas mientras se consulta el historial anterior, conserva la posición.

Las acciones del taller que cambian estado requieren confirmación, incluida la vuelta a presupuesto al modificar un trabajo en reparación. Los formularios de retiro, rechazo y externos ya son ventanas de confirmación. Las confirmaciones esperan el guardado, bloquean duplicados y permanecen abiertas ante un error. Iniciar o retomar en móvil lleva la ficha al inicio después del guardado, sin que restaurar el foco la desplace de nuevo.

`workspace-ux-browser.mjs` comprueba caché después de cambios externos, recargas lentas/fallidas sin desmontar tablas, cancelación y reintento de estados, scroll móvil y altura/agrupación de notas. Reutiliza perfiles; las órdenes de prueba se envían a la papelera. Capturas: `notas-mensajes-{claro,oscuro}-390.png`.

- `npm run lint`: sin errores; permanecen dos advertencias anteriores de Fast Refresh.
- `npm test`: 361 pruebas, 23 archivos.
- `npm run build`: compilación de producción y visor local incluidos; la demo continúa excluida.
- PostgreSQL descartable: 14 pruebas reales, adopción de una base anterior y restauración cifrada.
- Navegador: ingreso y contraseña, recorrido completo entre perfiles, permisos visibles, borradores y conflictos, siete pendientes, retiros, garantías, tablas, exportaciones, impresión simulada y PDF real.
- Regresiones específicas: un único aviso, fallo posterior de sincronización, doble clic, asignación diferida, cuatro modalidades de retiro, DNI, ausencia de selección automática, cambios desde otra sesión, consulta lenta, error y caché.
- Presentación: claro y oscuro en 1366×768, 1024×768 y 390×844; teclado, foco y ausencia de desbordamiento horizontal.

Ejecutar `node scripts/verify-local.mjs --ui --keep-open` después de compilar. El entorno exige su marcador de verificación y usa exclusivamente una base descartable en el proyecto. Con `--keep-open`, un fallo conserva ese entorno para revisar; Ctrl+C lo cierra. Las pruebas individuales pueden repetirse contra él sin usar la instalación Windows.

Las capturas y mediciones están en `test-results/integracion-ui/`. No se enviaron trabajos a impresoras físicas, no se hicieron pruebas de carga y no se certifica la instalación para producción con esta entrega.


### Ingreso completo y comunicación presencial

- Recepción consulta «Todos» y «Sin asignar» en Taller; «Mis trabajos» queda para técnicos y administración.
- Nueva orden exige nombre, DNI válido, domicilio, tipo, marca, modelo, estado, accesorios, acceso y notas. PIN, patrón o «El cliente no dejó contraseña» son alternativas; «Sin observaciones» y «Sin accesorios» permiten registrar explícitamente esos casos. La seña admite cero. Una revisión ingresa sin trabajo ni presupuesto inventados; una reparación definida requiere ambos.
- Los teléfonos son opcionales y se pueden registrar hasta tres. «Sin medio de comunicación» pertenece a la orden: no borra teléfonos ni marca un aviso ficticio. Con presupuesto pasa a Respuesta para registrar la confirmación presencial; terminado pasa a Retiros. No habilita una entrega anticipada.
- Buscar cliente abre una ventana. Un DNI coincidente carga los datos existentes; el servidor también reutiliza el cliente si otra PC lo creó mientras tanto. La creación por DNI se serializa dentro de la transacción. Los cambios explícitos en los datos del cliente se guardan al confirmar el formulario.
- Los modelos se filtran por marca y tipo, incluso mientras llega la consulta del catálogo. Se corrigen las categorías conocidas del catálogo inicial y se preserva el uso acumulado si ya existe la fila correcta. No se alteran las órdenes anteriores ni se adivina la categoría de modelos personalizados.
- La migración `20261030000000_intake_contact` agrega `noContact=false` para las órdenes existentes y corrige el catálogo. La recuperación de una copia anterior vuelve a aplicar estas correcciones.

`intake-browser.mjs` comprueba el formulario real, obligatoriedad, teléfonos, DNI, selector de clientes, respuesta lenta del catálogo, guardado y permisos visuales. Reutiliza perfiles y elimina sus ejemplos al terminar. `workflow.mjs` verifica concurrencia por DNI, validación de servidor, aprobación/rechazo presencial, retiro y respaldo/restauración. `verify-local.mjs` comprueba también una base anterior con categorías duplicadas y usos acumulados.

Estas correcciones posteriores al empaquetado no están incluidas en el instalador 1.2.1 ya generado. Requieren un nuevo paquete y su validación antes de actualizar Windows.
