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

- **Sin asignar:** tomar el iPhone 13, definir el tipo de reparación, enviar a recepción.
- **Reparación directa:** buscar OS1045 (Galaxy A15). Ingresa recibido, con cambio de módulo y precio definidos por Sofía en Recepción; pasa directo a reparación y se puede finalizar sin diagnóstico adicional.
- **Recepción:** el mismo equipo aparece para presupuestar. Guardar precio, registrar que se avisó al cliente y registrar su aprobación. Volver a Taller para iniciar la reparación.
- **Repuestos:** durante una reparación, solicitar un repuesto desde la sección Repuestos. En Recepción registrar pedido y llegada. El técnico retoma explícitamente.
- **Notas:** escribir una nota, cambiar de equipo y volver. El borrador se conserva; guardar agrega autor y fecha.
- **Finalización:** finalizar la reparación. En Recepción registrar aviso y retiro físico; puede retirar el titular o un tercero con nombre y DNI de ejemplo.
- **Rechazo:** en Recepción → Respuesta, elegir el iPhone 11 y registrar que retira sin reparar. Confirmar un cargo de revisión, incluido cero. El equipo permanece en Retiros hasta confirmar la entrega.
- **Saldo a favor:** en Recepción → Retiros, el monitor LG muestra presupuesto original, cargo de retiro y seña por separado. No se registra ningún movimiento de dinero.

Taller y Recepción se abren desde la navegación compartida. El selector cambia de perfil y abre su inicio. Cada cola conserva su selección, filtros, búsqueda y desplazamiento al volver. Cambiar de cola selecciona un equipo de esa cola; avanzar conserva la ficha aunque deje de coincidir con el filtro.

Taller y Recepción comparten la presentación de `OrderSheet`: identificación arriba; contraseña o PIN, patrón, estado del equipo, accesorios, notas generales y trabajo en el centro; cliente y seguimiento en el lateral de 300 px. La cola de Taller conserva aproximadamente un tercio del espacio (mínimo 320 px). Los datos no se repiten ni se ocultan en desplegables. Taller conserva sus acciones técnicas y no muestra los importes de Recepción. «Editar» dentro del trabajo permite modificar la reparación; «Guardar» vuelve a la consulta, incluso si no hubo cambios. Al iniciar una revisión sin reparación definida, el campo se abre para completarlo. Las esperas por repuestos siguen junto al trabajo. El Moto G84 incluye un patrón ficticio para revisar su visualización.

Los controles, estados y datos reemplazan las instrucciones repetidas en la ficha, navegación y ventanas. Se conservan la identificación de la demo y los mensajes breves de validación o de datos pendientes.

La cola de Taller muestra junto al equipo el tiempo desde que el técnico lo aceptó («· hace 2 h»), actualizado cada minuto. Se mantiene en todos «Mis trabajos», incluso durante las esperas por presupuesto o repuestos; iniciar reparación, retomar o guardar no lo reinicia. Los equipos sin aceptar no muestran tiempo. Tiempo y estado tienen prioridad de espacio sobre el nombre, que se recorta si hace falta. Los tiempos iniciales también son ficticios.

El trabajo vigente muestra quién lo definió. Guardar sin cambios conserva la autoría; modificar el trabajo actualiza su autor y guarda el texto anterior, el nuevo, autor y fecha en Historial. Los borradores no cambian la autoría hasta guardarse. El ejemplo OS1045 permite comprobar el paso de un trabajo definido por Sofía en Recepción a uno actualizado por Juan en Taller. Esta procedencia es parte de los datos ficticios; no modifica las APIs ni el esquema real.

Notas, Repuestos e Historial forman una barra compacta junto al encabezado, con iconos y cantidades. El encabezado alinea el equipo a la izquierda y el estado en el extremo derecho. Falla, trabajo y seguimiento usan columnas estables de etiquetas y valores, con un campo de lectura destacado para el trabajo vigente. Las herramientas se abren en ventanas emergentes; al cerrarlas se conserva la posición de la ficha y los borradores. Escape cierra la ventana y devuelve el foco al botón que la abrió; Tab permanece dentro. Las notificaciones se muestran por encima de las ventanas.

La demo usa Inter con títulos de 18 px y contenido y controles de 14 px. El botón de modo claro/oscuro está en la barra superior, también en móvil, y aplica a las dos vistas, ventanas, campos, patrón y notificaciones. Se inicia según el sistema; el cambio manual dura hasta recargar y no lee ni escribe la preferencia guardada de producción. Reiniciar los equipos de ejemplo conserva el tema elegido.

Los importes se mantienen fuera de la ficha técnica. Recepción muestra todos los datos sin desplegables; las fichas de consulta conservan su presentación de los datos de ingreso.

En escritorio se ven cola, ficha y lateral juntos; debajo de 1200 px se recorre lista → ficha → Volver a la cola. En móvil, el equipo y el trabajo aparecen antes del cliente y el seguimiento, sin colapsarlos y con desplazamiento vertical disponible. Las flechas recorren las filas; Enter abre el equipo. Tab recorre los controles y ventanas. Los borradores son independientes por orden y se conservan al cerrar las ventanas o cambiar de equipo.

## Validación

`npm run check` incluye las pruebas del simulador: toma, permisos simulados, revisión, presupuesto, respuesta, repuestos, retiro físico, saldos y aislamiento entre juegos de datos.

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

Asignar no agrega un paso de aceptación: se inicia revisión o reparación según el ingreso. En un equipo ya en taller, reasignar inicia el tiempo del nuevo técnico. La configuración de tarifa se utiliza como propuesta para los rechazos nuevos, con importe editable por Recepción.

Los formularios de ingreso, cliente, usuario y configuración conservan borradores al cerrar o navegar. Las contraseñas ficticias se descartan al cerrar la ventana. Reiniciar demo requiere confirmación si hay borradores y conserva el tema y perfil elegidos.

Las pruebas de dominio cubren estado compartido, entradas inválidas, visibilidad de rutas, restauración, papelera, perfiles y recorridos. Las pruebas de render cubren todas las pantallas sin AuthProvider/DataProvider; otra prueba comprueba que la entrada sigue bajo DEV y que el código de la demo no invoca API, almacenamiento de sesión o impresión.


Recepción muestra las siete tareas y sus cantidades en una barra que ocupa el ancho de la cola y la ficha. En escritorio y notebook se distribuyen en una fila; en móvil se acomodan en varias filas sin ocultar opciones. La barra permanece al abrir la ficha y muestra también los pendientes con cantidad cero. El botón de usuario del lateral (o el icono en móvil) abre la lista para cambiar de perfil. Ajustes aparece en la navegación lateral y permite editar el perfil y simular el cambio de contraseña para cualquier rol. Salir es un icono a la derecha del perfil, en una misma fila al pie de la barra. Los avatares usan 44 px; la barra mide 240 px en escritorio, 230 px en notebook y 280 px al desplegarla en móvil.


Las tareas de Recepción funcionan como pestañas con icono y cantidad, integradas en el mismo panel que la cola y la ficha, con un divisor interno. Tab entra por la pestaña seleccionada; las flechas izquierda/derecha cambian de tarea y Home/End van a la primera/última. Volver a pulsar la pestaña activa conserva la ficha abierta. Los borradores y la búsqueda se conservan al cambiar de tarea.


La ficha dentro de Recepción contiene solo información: encabezado compacto y datos completos a la vista. No usa desplegables: muestra nombre, DNI, tres teléfonos, correo y domicilio del cliente; tipo de dispositivo e ingreso, fecha, recepción y técnico encargado; contraseña, patrón, estado del equipo y accesorios; notas generales y trabajo vigente. Seguimiento muestra aviso, respuesta, responsables y fechas disponibles, técnico externo y entrega con datos de quien retiró. Los importes siguen visibles en la ficha, incluido el presupuesto original cuando se rechaza. Los valores ausentes se identifican como no registrados. Los datos de cliente se consultan desde la ficha compartida de clientes, sin copiar contactos a cada orden.

El botón inferior abre la tarea actual en una ventana: presupuesto, aviso, respuesta, repuestos, retiro, regreso externo o servicio simple. La confirmación está dentro de esa ventana y solo la cierra si la operación tiene éxito, sin abrir automáticamente la tarea siguiente ni seleccionar otro equipo. Cancelar, Escape o cerrar conservan el borrador y la posición de la ficha. Los borradores viven por orden y se conservan al cambiar de pestaña, equipo o página; se limpian solo los campos confirmados. Notas, repuestos e historial conservan sus ventanas. Acciones abre un menú junto al botón, con iconos, navegación por teclado y cierre con Escape o clic afuera; al elegir una acción, el menú se cierra antes de abrir su ventana o vista previa. El administrador ve la misma variante y no recibe acciones de Taller al terminar una tarea. Taller comparte la ficha informativa y conserva la edición y las acciones del técnico.

La ficha concentra los datos del equipo en el área principal: contraseña o PIN, patrón, estado del equipo y accesorios junto a las notas generales y el trabajo vigente. El lateral derecho ocupa toda la altura debajo de las pestañas y reúne cliente y contactos; un separador los distingue del seguimiento de ingreso, recepción, técnico, aceptación, aviso, respuesta y entrega cuando corresponde. El encabezado, los datos del equipo, los importes y la acción quedan a su izquierda. Se conservan el ancho exterior de la cola y de la ficha, los importes al pie, las tareas en ventanas y los datos sin desplegables. Mantiene Inter de 14 px, títulos de 18 px y ambos temas; las fechas de esta ficha usan hora de 24 horas. Los datos no registrados se muestran con una raya, sin ocupar espacio con avisos repetidos. En móvil el lateral se apila; los textos extensos se conservan completos con desplazamiento disponible.

La ficha central de Recepción se consulta en una sola columna: acceso, patrón si existe, estado del equipo, accesorios, notas generales y trabajo vigente. Las etiquetas y valores usan filas alineadas en escritorio y se apilan en móvil. El patrón conserva sus 96 px y se integra como otra fila, sin abrir una columna lateral. Notas generales corresponde a `issue`, el texto libre de recepción que el formulario original llama «Chequeos / notas generales»; `conditions` conserva las condiciones de ingreso bajo «Estado del equipo». La demo usa esos mismos nombres al crear, consultar e imprimir una orden. El lateral del cliente y seguimiento, y el pie con importes y acción, conservan su distribución.

Referencias de diseño: skill local `frontend-design` y separación de cliente, dispositivo y trabajo de RepairDesk (https://help.repairdesk.co/portal/en/kb/articles/can-i-update-edit-an-existing-ticket-s-details). Se adapta la jerarquía a los campos propios del sistema, sin incorporar campos ni reglas de esos productos.

La variante de registro compacto también toma como referencia la separación entre información del ticket y herramientas de RepairShopr (https://repair.uservoice.com/knowledgebase/articles/1851781-tickets) y las recomendaciones de NN/g sobre búsqueda visual y acceso a información secundaria (https://www.nngroup.com/articles/complex-application-design/). La composición es una adaptación a esta ficha, con sus datos y operaciones existentes.

La demo toma de la ficha real `issue` (chequeos y notas generales), `fix` (tipo de reparación; llamado `work` en el simulador) y `diagnosisType` (ingreso visible o a revisión, llamado `entry`). No agrega un diagnóstico independiente ni una confirmación de prueba de funcionamiento. Revisar `src/components/OrderModal.jsx`, `src/components/OrderForm.jsx`, `shared/fsm.js` y las validaciones de `server/index.js`. Al cambiar una reparación iniciada se vuelve a presupuesto, conservando precio y seña, con aviso y aprobación pendientes; Recepción puede ajustar el precio en la ventana antes del aviso.

La alta de órdenes de la demo recupera la selección rápida del formulario original: tipos con iconos, marcas y modelos ordenados por la cantidad de órdenes ficticias, búsqueda de cliente por nombre, DNI o teléfono y chips para estado, accesorios y trabajos. Las listas editables arrancan con los valores comunes del sistema. Otra marca/modelo abre un selector dentro del formulario, con búsqueda y entrada de un valor nuevo. El patrón se carga a la vista, junto al PIN. Se conservan DNI, domicilio y tipo personalizado al crear la orden; los borradores de los campos viven en el estado de la demo. El catálogo textual de ejemplo contiene teléfonos; las sugerencias de otros tipos se obtienen de sus órdenes ficticias. No se consulta el catálogo ni los clientes reales.
