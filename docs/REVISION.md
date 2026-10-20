# Evaluación del codebase — 19 de octubre de 2026

**Decisión recomendada: conservar la base y estabilizarla. No empezar desde cero.**

La separación frontend/API/base relacional es adecuada para un taller con varios usuarios. Ya existen órdenes con historial, clientes, roles, técnicos, repuestos, presupuestos, constancias, etiquetas y respaldos. Reescribir todo obligaría a reconstruir ese conocimiento del negocio sin eliminar los riesgos de despliegue ni la necesidad de probar los flujos.

## Qué está bien

- PostgreSQL y relaciones explícitas mediante Prisma: una base central compartida entre los equipos.
- Transiciones de estado definidas y catálogo reutilizable para órdenes.
- Roles administrativos, de recepción y de taller; comprobaciones también en servidor.
- Historial de actividad y generación de comprobantes.
- Docker separa los servicios y mantiene los datos en volúmenes.

## Fallos concretos corregidos en esta revisión

- La pantalla no leía correctamente la obligación de cambiar la contraseña inicial y enviaba nombres de campos diferentes a los que espera la API.
- Crear varios usuarios sin email podía chocar con la restricción única por guardar una cadena vacía en lugar de NULL.
- Editar una reparación llamaba al actualizador del catálogo con una firma incorrecta.
- El modal mostraba una entrega exitosa antes de cambiar el estado: ahora espera la operación y guarda retiro y estado juntos.
- El reingreso por garantía conservaba datos de la entrega anterior.
- Los filtros de terminados sin avisar podían mezclar presupuestos y excluir parte del último día de búsqueda.
- Se endurecieron validación de importes, patrones y permisos de edición, y se corrigió la diferencia entre enviar un diagnóstico a presupuesto y cargar su importe.
- Se retiró la dependencia del selector de patrones sobre jQuery, conservando el selector con SVG y Pointer Events.
- Los reintentos concurrentes de una misma solicitud crean una sola orden; el formulario conserva el cliente ya creado si necesita reintentar el guardado.
- El historial del cliente consulta todas sus órdenes, incluyendo entregadas, con paginación.
- La papelera permite recuperar clientes y órdenes durante 30 días, conservando sus historiales y las bajas anteriores independientes.
- La exportación CSV tenía una referencia a una variable inexistente. Ahora exporta todas las páginas filtradas y neutraliza fórmulas de hojas de cálculo.
- El refresco de datos ya puede esperarse; se corrigieron cierres involuntarios de los modales de entrega e impresión al sincronizar cambios.
- Se permite cambiar la contraseña desde el perfil y se sincroniza la expiración de sesión entre pestañas.
- Los registros de actividad y auditoría también usan selecciones de usuario sin hashes. Los errores técnicos ya no vuelcan al log los argumentos sensibles de Prisma.

## Seguridad y operación preparadas

Contraseñas mínimas de 8 caracteres, cambio inicial exigido por API, tokens vinculados a la contraseña actual, consultas de usuarios sin hashes en respuestas y permisos sobre retiros. Respaldos cifrados con verificación de integridad y restauración en una sola transacción. Se evita restaurar si no puede crearse una copia del estado previo.

El despliegue utiliza migraciones versionadas, verificaciones de salud, backend sin usuario root y exportación de respaldo antes de actualizar un backend activo. Las copias automáticas también se exportan a una carpeta del host; el panel informa su estado. Los archivos de entorno, herramientas temporales y respaldos quedan fuera de las imágenes. Se agregó autenticación al puente de impresión y bloqueo de scripts/red en el renderizador PDF. Hay un perfil opcional HTTPS local preparado.

Estos cambios no equivalen a una auditoría de seguridad independiente ni a una garantía de recuperación. Deben validarse en el entorno real antes de incorporar información empresarial.

## Deuda técnica que conviene resolver gradualmente

1. `server/index.js` todavía concentra muchas rutas, autorización y persistencia. Respaldos y papelera ya están separados; continuar con autenticación, órdenes e impresión conservando los contratos y las pruebas.
2. Varias pruebas antiguas reproducen lógica del sistema en lugar de llamar al código real. Se agregaron pruebas HTTP de la API y se conectaron las pruebas de autenticación a sus helpers reales; continuar reemplazando los espejos restantes.
3. Hay reglas de negocio repartidas entre componentes y servidor. Centralizar las validaciones compartidas para evitar diferencias; el servidor debe conservar la decisión final.
4. Los importes usan Float en el esquema. Antes de agregar una caja o facturación contable, migrar explícitamente a Decimal o centavos enteros y definir las reglas de redondeo.
5. La sincronización del frontend necesita más cobertura de desconexión, paginación y cambios simultáneos entre usuarios. La prueba de transición concurrente incorporada no cubre todos los conflictos posibles.

## Verificado y pendiente

Verificado localmente: compilación, esquema y generación de Prisma, **217 pruebas JS** incluyendo peticiones HTTP con persistencia simulada, **8 pruebas Python** del protocolo y selección de impresora sin imprimir. El linter conserva dos avisos de Fast Refresh en contextos React; no son errores de ejecución.

Última ejecución: `npm run test:browser` completó **11 pruebas de integración** con PostgreSQL y siete grupos de comprobaciones en Chrome, además de la adopción de una base anterior. `npm audit --audit-level=high` y `npm audit --prefix server --audit-level=high` reportaron cero vulnerabilidades conocidas el 19 de octubre de 2026.

**PostgreSQL real:** usuarios y permisos; cambio inicial de contraseña y revocación de sesión anterior; reintentos concurrentes sin duplicados; reparación, repuestos, revisión y aprobación; retorno externo; entrega y garantía; numeración concurrente; filtros e historial; papelera; PDF; respaldo AES-GCM y restauración con comprobación del recuento de órdenes. Se verificó además adoptar una base creada con `db push`, registrar la migración inicial y conservar un cliente existente.

**Chrome real:** siete grupos de comprobaciones cubren primer ingreso, alta con seña y patrón dibujado, apertura PDF, entrega persistida, garantía y recarga, vista móvil, CSV de 28 órdenes, restauración desde la papelera y cambio voluntario de contraseña. Se revisaron visualmente ambas constancias PDF, la papelera y el detalle móvil. Las bases de prueba son descartables, sin datos de la empresa.

**Pendiente antes de producción:** completar la construcción y arranque Docker, probar HTTPS y confianza de certificados desde cada dispositivo y comprobar etiquetas/PDF con las impresoras físicas. La construcción Docker fue interrumpida por un error de entrada/salida del almacenamiento WSL; se dejó ese diagnóstico para más adelante por indicación del usuario. Revisar los permisos de volúmenes existentes antes de actualizar una instalación que corría como root.

También falta elegir y verificar un destino de copia automática fuera de esta PC, guardar la clave por separado, proteger el disco de la base y documentar quién puede administrar Docker. Los respaldos internos y el cifrado de copias no cubren por sí solos la pérdida del equipo ni el acceso administrativo al host.

## Recomendación de alojamiento

Mantener Docker local durante la estabilización. Luego, si la PC del mostrador no puede permanecer encendida o necesita reiniciarse con frecuencia, mover el mismo stack a un equipo dedicado del local es un cambio operativo razonable; no requiere reescribir la aplicación. Elegir nube solo si se necesita acceso remoto o continuidad fuera del local, después de definir conectividad, impresión, costos y respaldo.

La demostración automática puede repetirse con `npm run test:browser`. Ver requisitos y alternativa Docker en el README. El siguiente hito de puesta en marcha es validar el mismo circuito en el equipo de producción con HTTPS, respaldo externo e impresoras reales.
