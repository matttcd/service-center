# Integración del diseño del Taller

Rama: `codex/integracion-ui`. El diseño utiliza las sesiones y operaciones reales. La demo continúa separada y excluida del paquete de producción.

## Funciones conservadas

La presentación comparte márgenes, tarjetas, campos y controles en todas las pantallas. Recepción, Taller, Resumen, Configuración y Papelera utilizan las mismas pestañas con navegación por teclado y contadores redondeados. El buscador de la cola comparte la fila del encabezado de la ficha; el cambio de tema queda junto a la marca y el perfil al fondo del sidebar.

Ajustes reúne los datos reales de la cuenta y el cambio de contraseña. La ventana de impresión muestra las páginas del PDF generado por el servidor junto al selector de impresora. El visor PDF.js se carga al abrir esta ventana y sus archivos quedan incluidos en la compilación: no requiere Internet ni el lector PDF del navegador. Se conserva la apertura del PDF en otra pestaña, y los reintentos no cambian la impresora elegida ni repiten automáticamente un envío fallido.

| Área | Comprobación |
|---|---|
| Órdenes y Terminados | Tablas originales, columnas, búsqueda, filtros, ordenamiento, paginación y acceso a la ficha. |
| Exportación | CSV de todas las páginas; columnas originales conservadas y nuevos importes del rechazo agregados al final. |
| Resumen y Métricas | Dashboard e indicadores originales; los ingresos de rechazos usan el importe de retiro al entregarse. |
| Clientes | Alta, edición, contactos, baja e historial paginado de órdenes. |
| Taller | Mis trabajos, Sin asignar y Todo el taller; revisión, reparación directa, presupuesto, repuestos y finalización. |
| Recepción | Siete pendientes, aviso, respuesta, retiro, servicios simples y técnicos externos. |
| Ficha | Datos originales del equipo y cliente, notas, repuestos, historial, edición, impresión y acciones excepcionales. |
| Retiros | Titular, tercero autorizado, retiro anticipado, sin orden y constancia PDF. |
| Garantía | Reingreso, historial y nuevo ciclo de aceptación. |
| Administración | Usuarios, actividad, papelera, respaldos, configuración, impresoras, catálogo, listas y términos. |
| Cuenta | Autenticación al cambiar de perfil, cierre de sesión y contraseña en Ajustes; cambio inicial obligatorio conservado. |

## Datos y compatibilidad

- Migración aditiva `20261026000000_workspace_ui`: `acceptedAt`, `rejectedCharge`, `rejectedAt` y `rejectedBy`, todos opcionales. No convierte órdenes antiguas.
- Aceptación registrada por el servidor al iniciar el trabajo. Las asignaciones administrativas no cuentan como aceptación. Reasignación y garantía reinician la fecha. Para asignaciones de trabajos ya iniciados, el técnico tiene «Aceptar trabajo» en Acciones.
- Estado `presupuesto_rechazado`: conserva presupuesto y seña, requiere importe de retiro explícito (incluido cero) y permanece pendiente hasta la entrega física.
- El saldo de un rechazo usa su importe de retiro; puede mostrar saldo a favor. No se crea un registro de caja ni se presume una devolución de dinero.
- `POST /api/orders/:id/status` admite el nuevo estado y `rejectedCharge`. `POST /api/orders/:id/assign` admite `accept: true` para aceptar la propia asignación.
- `PUT /api/orders/:id` admite `expected` con los valores originales editados. Ante conflicto devuelve 409 y conserva el borrador. La ficha muestra los datos actuales y permite conservar la edición después de revisarlos; los campos independientes de otra PC no se sobrescriben. El PIN, el patrón y la opción sin contraseña se revisan juntos. `sendToBudget: true` permite guardar el cambio de trabajo y devolverlo a presupuesto en una transacción.
- Recepción puede registrar pedido y llegada de repuestos sin modificar la solicitud técnica.
- Se reutiliza la migración del arranque al restaurar respaldos antiguos. La copia previa de seguridad se conserva si falla la recuperación.
- Los borradores viven en memoria: sobreviven a navegación y cierre de ventanas, se eliminan al cerrar sesión o cambiar de usuario y se advierte antes de recargar con cambios pendientes. PIN y datos de clientes no se guardan en almacenamiento del navegador.

## Verificación local aislada

```powershell
npm run lint
npm test
npm run build
node scripts/verify-local.mjs --ui
```

El último comando crea PostgreSQL descartable, aplica migraciones y ejecuta negocio, permisos, concurrencia, PDF, respaldo/restauración y navegador. Requiere los binarios de PostgreSQL 16 usados por las verificaciones existentes y Chromium. No utiliza la base instalada.

Incluye la revisión de las 13 pantallas en ambos temas a 1366×768, 1024×768 y 390×844, verificando pestañas, foco, alineación del buscador, perfil y ausencia de desbordamientos horizontales.

Para dejar el entorno de revisión abierto después de superar las pruebas:

```powershell
node scripts/verify-local.mjs --ui --keep-open
```

Dirección: `http://127.0.0.1:8181`. Ctrl+C cierra los procesos y elimina la base descartable. Las capturas se guardan en `test-results/integracion-ui/`.

Los perfiles «Técnico UI» y «Recepción UI» usan `Workspace-test-2026` exclusivamente en esta base de pruebas. El administrador de esta verificación usa `Browser-updated-2026`.

## Entrega e instalación

No se cambian servicios, carpetas, certificados, impresoras ni datos de la instalación Windows. No se publica un instalador desde esta entrega. Una futura actualización debe realizar el respaldo previo y aplicar las migraciones antes de abrir la nueva interfaz. No volver a un ejecutable anterior mientras existan órdenes con el nuevo estado.

La impresión física requiere la comprobación habitual con las impresoras del local; estas pruebas generan PDF sin enviar trabajos a las colas reales.
