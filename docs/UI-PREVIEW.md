# Vista previa del flujo de Taller y Recepción

Rama: `codex/redisenio-ui-flujo`.

```powershell
npm ci
npm run dev:ui
```

Abrir <http://127.0.0.1:5175/flow-preview.html>.

Esta entrada es independiente de la aplicación principal: no monta los proveedores de autenticación ni de datos, no usa una sesión guardada y no llama a la API. Solo carga recursos locales de Vite. Los equipos, personas, teléfonos y accesos son ficticios. Los cambios y borradores viven en la memoria de esta pestaña; recargar o reiniciar los descarta. No requiere backend, base de datos ni servicios de Windows.

La entrada está habilitada únicamente en desarrollo y no se incluye en la compilación de producción habitual. No ejecutar la vista previa usando la URL de la instalación Windows.

## Recorridos para revisar

- **Sin asignar:** tomar el iPhone 13, completar diagnóstico y trabajo propuesto, enviar a recepción.
- **Recepción:** el mismo equipo aparece para presupuestar. Guardar precio, registrar que se avisó al cliente y registrar su aprobación. Volver a Taller para iniciar la reparación.
- **Repuestos:** durante una reparación, solicitar un repuesto desde la sección Repuestos. En Recepción registrar pedido y llegada. El técnico retoma explícitamente.
- **Notas:** escribir una nota, cambiar de equipo y volver. El borrador se conserva; guardar agrega autor y fecha.
- **Finalización:** confirmar la prueba de funcionamiento y finalizar. En Recepción registrar aviso y retiro físico; puede retirar el titular o un tercero con nombre y DNI de ejemplo.
- **Rechazo:** en Recepción → Respuesta, elegir el iPhone 11 y registrar que retira sin reparar. Confirmar un cargo de revisión, incluido cero. El equipo permanece en Retiros hasta confirmar la entrega.
- **Saldo a favor:** en Recepción → Retiros, el monitor LG muestra presupuesto original, cargo de retiro y seña por separado. No se registra ningún movimiento de dinero.

Taller y Recepción pueden alternarse desde la navegación o el selector superior. Se conserva el equipo seleccionado al pasar de un rol al otro cuando hay una tarea correspondiente. Cambiar de cola selecciona un equipo de esa cola; avanzar conserva la ficha aunque deje de coincidir con el filtro.

En escritorio se ven cola y ficha juntas; debajo de 1200 px se recorre lista → ficha → Volver a la cola. Las flechas recorren las filas y las pestañas de información; Enter abre el equipo. Los borradores son independientes por orden.

## Validación

`npm run check` incluye las pruebas del simulador: toma, permisos simulados, diagnóstico, presupuesto, respuesta, repuestos, retiro físico, saldos y aislamiento entre juegos de datos.

La revisión en navegador debe comprobar 1366×768, 1024×768 y 390×844, además de ausencia de llamadas `/api/`, errores de consola y desbordamiento horizontal. Las capturas se guardan en `test-results/ui-preview/`, fuera de Git.

Esta entrega permite evaluar la interacción. La autorización real, concurrencia, persistencia, nuevos estados de negocio, impresión y migraciones se integrarán después de revisar el diseño.
