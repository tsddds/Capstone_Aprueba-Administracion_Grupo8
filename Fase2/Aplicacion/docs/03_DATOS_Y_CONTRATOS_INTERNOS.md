# Datos y contratos internos

El backend utiliza Firestore. Cada colección contiene documentos con campos e identificadores; las relaciones se mantienen mediante ID y transacciones. La especificación funcional es la sección 4 de Aprueba_API_Backend.docx.

## Entornos y datos

Desarrollo utiliza `demo-aprueba-equipo` con volumen persistente. Las suites utilizan `demo-aprueba-tests`, un emulador separado que restablecen al comenzar. La semilla `backend/dev/fixtures.mjs` y el cargador `seed.mjs` generan cuentas y registros ficticios. No se requieren credenciales de Firebase remoto.

Colecciones de negocio: `adminUsers`, `users`, `sponsors`, `questions`, `corrections`, `tickets`, `plans`, `features`, `subscriptions`, `payments`, `platforms` y las fuentes de eventos. Colecciones operativas: `appConfig`, `metrics`, `adminAudit`, `serviceObservations`, `planPriceOperations` y `adminEmailClaims`.

## Usuarios y recorrecciones

Los ID existentes se conservan. E14 reserva el correo normalizado en `adminEmailClaims/{sha256(correo.trim().toLowerCase())}`. La reserva nueva, liberación de la anterior propia, usuario y auditoría se escriben en una transacción. Los registros heredados sin índice se comprueban antes de escribir y se releen los candidatos dentro de la transacción. Los escritores futuros de correo deben utilizar este mecanismo; la búsqueda heredada requiere evaluación antes de escalar.

E18 resuelve solicitudes pendientes mediante transacción. Una confirmación concede 250 medallas de bronce y crea movimiento y notificación; una repetición responde 409. La nota interna es opcional, de hasta 2000 caracteres, y se guarda en la solicitud para administración y soporte. El aviso al alumno y la respuesta PATCH no incluyen esa nota.

La importación de preguntas guarda borradores y reporta errores por fila. Admite eje o dificultad pendientes de clasificación; ambos deben estar completos para publicar. La edición conserva las explicaciones de texto o estructuradas.

## Planes e indicadores

- CLP es la moneda del conjunto interno acordado. Precio entero entre 0 y 99999999; no convertir silenciosamente strings, fracciones, negativos o límites inválidos. No se pretende cubrir otras monedas con esta validación.
- `subscriptions.plan` referencia el ID físico del plan. Para métricas, estado active y fin de período futuro; inicio, si existe, ya ocurrido. Para eliminación se conserva el bloqueo ante una activa con vencimiento ausente/inválido o todavía futuro.
- Crear suscripciones queda fuera de las 27 rutas administrativas. Cualquier escritor futuro debe leer el plan dentro de su misma transacción antes de crear la referencia: sin esa coordinación, un escritor externo/manual puede romper integridad después de borrar un plan.
- E14 conserva su semántica: cambiar `users.plan` no factura ni altera `subscriptions`. No se migran suscriptores existentes al precio nuevo de Stripe.
- MRR suma importes recurrentes de suscripciones vigentes, normalizando anual /12 y `intervalCount`. Usa `unitAmount` de suscripción cuando existe; catálogo como fallback legado. Moneda/ciclo/precio incoherentes se excluyen y se informa `quality.missingSubscriptionPrices`. No es equivalente a pagos cobrados.
- MAU: usuarios distintos con actividad en `(ahora - 30 días, ahora]`. DAU: últimas 24 horas. Se usan `users.lastActivity` y `activityEvents` cuando existen, sin derivarlo del estado administrativo ni sumar usuarios únicos diarios. Conversión: usuarios MAU con suscripción de pago vigente / MAU; cero si no hay MAU.
- `range`: 7d, 30d, 90d o 365d. Es una decisión interna porque el Word no enumera valores. Afecta ingresos cobrados, emisión, actividad del rango y series; DAU y MAU conservan sus ventanas definidas. Total de descargas es acumulado hasta ahora; descargas del mes usa mes calendario de la zona configurada.
- Series mensuales agrupadas en `appConfig/metrics.timeZone` (America/Santiago por defecto), con meses vacíos en cero. Eventos con `eventId` repetido se cuentan una vez. Sin `eventId`, el ID de documento identifica el evento.
- `collectedRevenue` suma pagos paid en CLP dentro del rango, no pagos reembolsados o fallidos. Los importes de los fixtures siguen identificados como ficticios en sus documentos de origen.
- Emisión de medallas: `badgeEvents` y `users/*/medalMovements`, deduplicados por evento/corrección. Los saldos `users.medals` y el contador genérico `badges` no se reinterpretan como histórico de emisión. Sin movimientos, emisión registrada es cero, con `quality.badgeHistory=recorded-issuance-only`; no significa que históricamente no se hayan emitido medallas.
- Las fuentes iniciales no contienen historia completa para reconstruir MAU/MRR del período anterior. Sus deltas son null, no un cero inventado; `quality.historicalComparisons` explicita el límite. Delta de descargas compara acumulado del mes actual con el mes calendario anterior, null si el anterior es cero. Completar comparativas exige acordar/guardar historia de actividad y suscripciones, no inferirla de saldos actuales.
- Salud agregada solo desde `serviceObservations` con observación de los últimos cinco minutos; sin observaciones: unknown y `servicesDown=null`. No se consultan fixtures de contenedores para fingir medición real.

## Actualización y proveedor de precios

`appConfig/metrics` contiene `metricsRefreshSeconds` (300), `dashboardPollSeconds` (60), `timeZone` y `currency=CLP`. Las frecuencias aceptan enteros entre 1 y 86400. Una configuración inválida responde 503. Los procesos persistentes recalculan por intervalo y las consultas renuevan una caché vencida. Las variantes de ambos paneles se guardan en una transacción. Las agregaciones actuales leen colecciones completas y requieren evaluación con mayor volumen.

El trigger operativo GET `/internal/metrics/refresh` permite una agenda remota, con `CRON_SECRET` independiente del JWT. La configuración y validación en Vercel se realizan según la guía de cierre.

Los cambios de precio usan Stripe de pruebas y crean un nuevo Price mensual en CLP. El precio local se guarda después de confirmar el proveedor. `planPriceOperations/{planId}` registra la operación, revisión e idempotencia. Tras un fallo, reintentar el mismo cambio conserva la operación. Una operación de más de 23 horas requiere conciliación con Stripe. Esta versión no migra suscripciones al nuevo precio. La aceptación externa continúa pendiente.

## Laboratorio operativo

Solo se permite reiniciar `aprueba-ops-lab`, creado para esta prueba y con etiqueta `aprueba.ops.allowed=local-test-only`. El backend no recibe el socket Docker. Un bridge separado expone únicamente lectura del objetivo y su reinicio, con token y red interna sin puertos publicados.

**El bridge sí tiene acceso privilegiado al daemon Docker. El montaje `:ro` no convierte la API del socket en solo lectura.** Este aislamiento reduce la superficie, pero no es una frontera de seguridad para código no confiable. Usarlo únicamente en el equipo local autorizado, nunca en un host de producción. El token de Compose es de laboratorio, no secreto productivo. No conectar contenedores ajenos a la red de control.

Al terminar la demostración, detener el componente privilegiado sin borrar datos:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml stop ops-bridge ops-lab
```

Volver a arrancarlos con `docker compose -f compose.yaml -f compose.ops.yaml up -d ops-lab ops-bridge`.

E10 expresa CPU como porcentaje del tiempo agregado del host entre muestras, y memoria como porcentaje del working set sobre el límite del contenedor. Un dato no disponible se representa con `null`. E09 calcula `uptime` como porcentaje de sondas exitosas desde la primera observación. Cada consulta produce una muestra; cambiar la URL reinicia la serie del servicio. Los parámetros del laboratorio son timeout de 2 segundos y estado degradado cuando la latencia supera 500 ms.

E11 responde 202 y registra la solicitud. Una lectura posterior de E10 verifica el cambio de StartedAt y marca la auditoría `verified`. Si ocurre un timeout y el estado queda `unknown`, comprobar el contenedor antes de reintentar.

Los pasos para configurar la cuenta de pruebas y aceptar las integraciones están en [cierre y entrega](18_CIERRE_FASE2_Y_ENTREGA.md).
