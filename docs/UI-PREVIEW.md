# Demo completa de Service Center

Rama: `codex/redisenio-ui-flujo`.

```powershell
npm ci
npm run dev:ui
```

Abrir <http://127.0.0.1:5175/flow-preview.html#/taller>.

El selector superior cambia entre Técnico (inicio Taller), Recepción (inicio Recepción) y Administrador (inicio Resumen). Cada perfil tiene navegación agrupada en Trabajo, Consultas y Administración. Los permisos son simulados; no prueban la autorización de producción. Los enlaces hash admiten Atrás/Adelante sin recargar ni perder el estado. Un enlace directo elige inicialmente un perfil que pueda consultar esa pantalla.

Esta entrada es independiente de la aplicación principal: no monta los proveedores de autenticación ni de datos, no usa una sesión guardada y no llama a la API. Solo carga recursos locales de Vite. Los equipos, personas, teléfonos y accesos son ficticios. Los cambios y borradores viven en la memoria de esta pestaña; recargar o reiniciar los descarta. No requiere backend, base de datos ni servicios de Windows.

La entrada está habilitada únicamente en desarrollo y no se incluye en la compilación de producción habitual. No ejecutar la vista previa usando la URL de la instalación Windows.

## Recorridos para revisar

- **Sin asignar:** tomar el iPhone 13, completar diagnóstico y trabajo propuesto, enviar a recepción.
- **Reparación directa:** buscar OS1045 (Galaxy A15). Tiene un cambio de módulo definido en recepción por Sofía y presupuesto aprobado; se puede iniciar y finalizar sin completar un diagnóstico.
- **Recepción:** el mismo equipo aparece para presupuestar. Guardar precio, registrar que se avisó al cliente y registrar su aprobación. Volver a Taller para iniciar la reparación.
- **Repuestos:** durante una reparación, solicitar un repuesto desde la sección Repuestos. En Recepción registrar pedido y llegada. El técnico retoma explícitamente.
- **Notas:** escribir una nota, cambiar de equipo y volver. El borrador se conserva; guardar agrega autor y fecha.
- **Finalización:** confirmar la prueba de funcionamiento y finalizar. En Recepción registrar aviso y retiro físico; puede retirar el titular o un tercero con nombre y DNI de ejemplo.
- **Rechazo:** en Recepción → Respuesta, elegir el iPhone 11 y registrar que retira sin reparar. Confirmar un cargo de revisión, incluido cero. El equipo permanece en Retiros hasta confirmar la entrega.
- **Saldo a favor:** en Recepción → Retiros, el monitor LG muestra presupuesto original, cargo de retiro y seña por separado. No se registra ningún movimiento de dinero.

Taller y Recepción se abren desde la navegación compartida. El selector cambia de perfil y abre su inicio. Cada cola conserva su selección, filtros, búsqueda y desplazamiento al volver. Cambiar de cola selecciona un equipo de esa cola; avanzar conserva la ficha aunque deje de coincidir con el filtro.

En Taller se usa la variante con cola de aproximadamente un tercio del espacio (mínimo 320 px), trabajo en el centro y referencia lateral (240 px). La referencia contiene cliente, teléfono, contraseña o PIN, patrón si tiene, estado físico y accesorios, sin repetirlos en la ficha. Falla, diagnóstico y trabajo se leen completos y apilados en el centro. La falla informada por Recepción se consulta sin editar y está separada del bloque técnico. «Editar» dentro del bloque técnico permite modificar diagnóstico y trabajo; «Guardar» en el mismo lugar vuelve a la consulta, incluso si no hubo cambios. Al iniciar una revisión sin diagnóstico ni trabajo, los campos se abren para completarlos. Las esperas por repuestos se muestran junto al trabajo. El Moto G84 incluye un patrón ficticio para revisar su visualización.

Los controles, estados y datos reemplazan las instrucciones repetidas en la ficha, navegación y ventanas. Se conservan la identificación de la demo y los mensajes breves de validación o de datos pendientes.

La cola de Taller muestra junto al equipo el tiempo desde que el técnico lo aceptó («· hace 2 h»), actualizado cada minuto. Se mantiene en todos «Mis trabajos», incluso durante las esperas por presupuesto o repuestos; iniciar reparación, retomar o guardar no lo reinicia. Los equipos sin aceptar no muestran tiempo. Tiempo y estado tienen prioridad de espacio sobre el nombre, que se recorta si hace falta. Los tiempos iniciales también son ficticios.

El trabajo vigente muestra quién lo definió. Guardar solamente el diagnóstico conserva la autoría del trabajo; modificar el trabajo actualiza su autor y guarda el texto anterior, el nuevo, autor y fecha en Historial. Los borradores no cambian la autoría hasta guardarse. El ejemplo OS1045 permite comprobar el paso de un trabajo definido por Sofía en Recepción a uno actualizado por Juan en Taller. Esta procedencia es parte de los datos ficticios; no modifica las APIs ni el esquema real.

Notas, Repuestos e Historial tienen botones con cantidades debajo del encabezado del equipo. Se abren en ventanas emergentes; al cerrarlas se conserva la posición de la ficha y los borradores. Escape cierra la ventana y devuelve el foco al botón que la abrió; Tab permanece dentro. Las notificaciones se muestran por encima de las ventanas.

La demo usa Inter con títulos de 18 px y contenido y controles de 14 px. El botón de modo claro/oscuro está en la barra superior, también en móvil, y aplica a las dos vistas, ventanas, campos, patrón y notificaciones. Se inicia según el sistema; el cambio manual dura hasta recargar y no lee ni escribe la preferencia guardada de producción. Reiniciar los equipos de ejemplo conserva el tema elegido.

Los importes se mantienen fuera de la ficha técnica. En Recepción y en las tablas de consulta, se conservan la consulta del diagnóstico y los datos de ingreso en desplegables y el botón para mostrar el acceso.

En escritorio se ven cola, trabajo y referencia juntos; debajo de 1200 px se recorre lista → ficha → Volver a la cola, manteniendo trabajo y referencia juntos. En móvil, Taller apila referencia y trabajo sin colapsarlos, con desplazamiento vertical de la página. Las flechas recorren las filas; Enter abre el equipo. Tab recorre los controles y ventanas. Los borradores son independientes por orden y se conservan al cerrar las ventanas o cambiar de equipo.

## Validación

`npm run check` incluye las pruebas del simulador: toma, permisos simulados, diagnóstico, presupuesto, respuesta, repuestos, retiro físico, saldos y aislamiento entre juegos de datos.

La revisión en navegador debe comprobar 1366×768, 1024×768 y 390×844, además de ausencia de llamadas `/api/`, errores de consola y desbordamiento horizontal. Las capturas se guardan en `test-results/ui-preview/`, fuera de Git.

Esta entrega permite evaluar la interacción. La autorización real, concurrencia, persistencia, nuevos estados de negocio, impresión y migraciones se integrarán después de revisar el diseño.


## Inventario de la demo

| Pantalla actual | Recorrido simulado y enlace |
| --- | --- |
| Taller | [Cola y ficha técnica](http://127.0.0.1:5175/flow-preview.html#/taller): aceptación, revisión, trabajo, notas, repuestos y finalización. |
| Recepción / Nueva orden | [Pendientes](http://127.0.0.1:5175/flow-preview.html#/recepcion): alta de cliente y equipo, revisión o reparación definida, seña, acceso y patrón, presupuesto, respuesta, aviso, retiro y servicios simples. |
| Órdenes / detalle | [Listado](http://127.0.0.1:5175/flow-preview.html#/ordenes): búsqueda, filtros, paginación, ficha compartida, asignación, comprobante y etiqueta ficticios desde Más. |
| Terminados | [Listos y entregados](http://127.0.0.1:5175/flow-preview.html#/terminados): retiro y reingreso por garantía desde Más. OS1010 permite probar el reingreso. |
| Clientes / detalle | [Clientes](http://127.0.0.1:5175/flow-preview.html#/clientes): alta, edición y órdenes relacionadas; actualizar nombre o teléfono modifica sus órdenes. |
| Dashboard / Metrics | [Resumen](http://127.0.0.1:5175/flow-preview.html#/resumen) y [Métricas](http://127.0.0.1:5175/flow-preview.html#/metricas): conteos e importes calculados y enlaces a pendientes/listados filtrados. |
| Actividad | [Historial global](http://127.0.0.1:5175/flow-preview.html#/actividad): búsqueda por orden, cambio y autor, fecha y cambios del trabajo. |
| Usuarios | [Usuarios](http://127.0.0.1:5175/flow-preview.html#/usuarios): alta, perfil y activar/desactivar, conservando un administrador activo. |
| Backups | [Copias](http://127.0.0.1:5175/flow-preview.html#/copias): instantáneas en memoria, confirmación de restauración y resultado simulado. No genera archivos, cifrado ni claves. |
| Trash | [Papelera](http://127.0.0.1:5175/flow-preview.html#/papelera): eliminación recuperable de órdenes y clientes y restauración, incluyendo sus relaciones. |
| Settings | [Configuración](http://127.0.0.1:5175/flow-preview.html#/configuracion): tarifa de revisión, impresoras ficticias/PDF/ZPL, papel y etiqueta, opciones, catálogo por texto/ejemplo, términos y técnicos externos. |
| Login / cuenta | [Acceso](http://127.0.0.1:5175/flow-preview.html#/acceso): ingreso ficticio, ventanas de perfil y contraseña sin almacenar credenciales. |

OS1033 está en Laboratorio Sur. Se pueden enviar otros equipos desde Más o durante el alta, y registrar su regreso desde Recepción → Externos. OS1048 es un servicio simple. El retiro admite terceros y retiro sin comprobante. Las copias solo existen hasta recargar; los borradores se descartan al restaurar una copia tras confirmarlo.

La asignación manual no inicia el reloj de trabajo: el técnico debe aceptar el equipo. Editar solo el diagnóstico conserva la autoría del trabajo. La configuración de tarifa se utiliza como propuesta para los rechazos nuevos, con importe editable por Recepción.

Los formularios de ingreso, cliente, usuario y configuración conservan borradores al cerrar o navegar. Las contraseñas ficticias se descartan al cerrar la ventana. Reiniciar demo requiere confirmación si hay borradores y conserva el tema y perfil elegidos.

Las pruebas de dominio cubren estado compartido, entradas inválidas, visibilidad de rutas, restauración, papelera, perfiles y recorridos. Las pruebas de render cubren todas las pantallas sin AuthProvider/DataProvider; otra prueba comprueba que la entrada sigue bajo DEV y que el código de la demo no invoca API, almacenamiento de sesión o impresión.


Recepción muestra las siete tareas y sus cantidades en una barra que ocupa el ancho de la cola y la ficha. En escritorio y notebook se distribuyen en una fila; en móvil se acomodan en varias filas sin ocultar opciones. La barra permanece al abrir la ficha y muestra también los pendientes con cantidad cero. El botón de usuario del lateral (o el icono en móvil) abre la lista para cambiar de perfil. Ajustes, junto a Salir, permite editar el perfil y simular el cambio de contraseña para cualquier rol; estas acciones ya no aparecen directamente debajo del usuario.


Las tareas de Recepción funcionan como pestañas con icono y cantidad, integradas en el mismo panel que la cola y la ficha, con un divisor interno. Tab entra por la pestaña seleccionada; las flechas izquierda/derecha cambian de tarea y Home/End van a la primera/última. Volver a pulsar la pestaña activa conserva la ficha abierta. Los borradores y la búsqueda se conservan al cambiar de tarea.


La ficha dentro de Recepción usa una variante propia: encabezado compacto, falla y trabajo visibles, herramientas y datos de ingreso secundarios, y formulario de tarea al final, antes de la confirmación fija. Respuesta, rechazo, retiro y regreso externo se completan directamente en la ficha. Sus borradores viven por orden y se conservan al cambiar de pestaña, equipo o página; se limpian solo los campos confirmados. El administrador ve la misma variante y no recibe acciones de Taller en esta pantalla al terminar una tarea. Las demás fichas conservan su presentación anterior.
