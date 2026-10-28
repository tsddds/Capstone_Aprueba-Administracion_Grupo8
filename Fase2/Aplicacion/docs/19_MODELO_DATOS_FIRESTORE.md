# Modelo de datos de Firestore

Aprueba Administración almacena documentos en colecciones de Cloud Firestore. No utiliza tablas SQL ni ejecuta un esquema de creación de tablas. Los documentos se crean mediante el backend y el cargador de datos ficticios. Este modelo describe la implementación integrada de Fase 2 al 27 de octubre de 2026.

## Entornos y acceso

Desarrollo usa el emulador `demo-aprueba-equipo`, con un volumen Docker que conserva los cambios. Las pruebas usan `demo-aprueba-tests`, separado de desarrollo y preparado para cada ejecución. El cargador `backend/dev/seed.mjs` comprueba que el destino sea uno de esos emuladores y crea únicamente documentos que no existen.

El navegador accede a la API Express. La API valida el JWT, los permisos y los campos antes de usar Firebase Admin SDK. El cliente administrativo no necesita una clave de cuenta de servicio. Para inspeccionar los datos locales se abre http://localhost:4001/firestore. Los cambios del emulador no modifican la base remota ni Vercel.

## Colecciones de negocio

- **`adminUsers/{adminId}`**: identidad administrativa, `name`, `email`, `role`, `passwordHash` y `mfaEnabled`, además de los campos de MFA que usa autenticación. Los roles son `admin`, `support`, `finance` y `ops`. El hash y los datos de autenticación no forman parte de las vistas de usuario alumno.
- **`users/{userId}`**: perfil del alumno y campos como `name`, `email`, `country`, `plan`, `state`, `lastActivity`, `createdAt`, `medals`, `badges`, `devices` y `recentActivity`. `plan` contiene un identificador de plan. `medals` distingue saldos de bronce, plata, oro, diamante y platino. `badges` es un contador independiente.
- **`subscriptions/{subscriptionId}`**: relación de un alumno con un plan mediante `userId`, `plan`, `status`, `billingCycle` y `currentPeriodEnd`. La eliminación de planes consulta esta colección; no basta con el campo de plan del perfil.
- **`plans/{planId}`**: `name`, `price`, `color`, `features`, `limits`, marcas temporales y `revision`. `features` es una lista de identificadores de `features`. `limits` contiene límites como `qDay`, `groups` y `tests`. Cuando se confirma un precio externo, `billing` conserva la referencia al producto y al Price de pruebas.
- **`features/{featureId}`**: catálogo de funcionalidades disponibles para los planes. Incluye el nombre y, en los datos heredados, los textos por idioma y el icono.
- **`sponsors/{sponsorId}`**: nombre, categoría, cuota, estado, contadores y arreglo embebido `benefits`. Cada beneficio puede guardar identificador, nombre, descripción, costo, stock y `active`. La baja conserva el documento con `deletedAt`, estado `down` y beneficios inactivos.
- **`questions/{questionId}`**: `testId`, `axis`, `difficulty`, `statement`, `options`, `correctAnswer`, `explanation`, `requiredSkill` y `status`. `options` contiene entre dos y cinco alternativas; `correctAnswer` es la letra correspondiente. `explanation` admite texto o un objeto con `title`, `subject`, `steps`, `verification` y `keyConcept`. Los estados son `draft`, `published`, `flagged` y `retired`. La importación guarda borradores y admite clasificación pendiente cuando el flujo lo permite.
- **`tickets/{ticketId}`**: `userId`, `subject`, `state`, `priority`, `assigneeId`, fechas y `lastReply`. Las respuestas se almacenan además en `tickets/{ticketId}/replies/{replyId}`, con texto, autor y fecha.
- **`corrections/{correctionId}`**: vincula `userId` y `questionId`; contiene motivo, comentario, `state` y, tras la resolución, `resolvedBy`, `resolvedAt`, `rewardGranted` y la nota interna opcional `note`. Los estados son `pending`, `confirmed` y `rejected`.

## Notificaciones y movimientos

Al resolver una recorrección se crea `users/{userId}/notifications/{correctionId}`, con tipo, resolución, mensaje, fecha y estado de lectura. La nota interna no se copia a ese mensaje. Al confirmar se crea también `users/{userId}/medalMovements/{correctionId}` y se incrementa en 250 el saldo de bronce. Documento, saldo, movimiento, eventual cambio de pregunta y notificación se escriben en una transacción. Una solicitud resuelta no vuelve a premiarse.

## Auditoría y controles internos

- **`adminAudit/{eventId}`** registra las acciones implementadas de administración de usuarios, tickets, planes y reinicios, con entidad, actor y fecha, junto con los datos de cambio aplicables. No representa un historial exhaustivo de todas las rutas.
- **`adminEmailClaims/{hash}`** reserva un correo normalizado para un `userId`. El identificador es su SHA-256. La reserva y el cambio de usuario se coordinan en una transacción. Los perfiles anteriores al índice se comprueban también mediante una búsqueda heredada.
- **`questionImportKeys/{key}`** permite detectar las filas ya importadas y relacionarlas con su pregunta. La escritura usa una transacción para coordinar reintentos y duplicados.
- **`planPriceOperations/{planId}`** guarda estado, huella del cambio, `operationId`, revisión de origen y fechas. Coordina el reintento de un precio sin crear operaciones distintas para la misma solicitud. Las operaciones antiguas requieren conciliación con Stripe.

Las referencias entre documentos son identificadores de texto, no claves foráneas SQL. El backend comprueba las referencias y las reglas de negocio en las operaciones que las requieren. Firestore no impone estas relaciones automáticamente.

## Fuentes de indicadores y operación

`payments`, `downloadEvents`, `activityEvents` y `badgeEvents` aportan registros al cálculo. Se leen además usuarios, suscripciones, planes, patrocinadores y movimientos de medallas. Los ejemplos del cargador son ficticios y no acreditan cobros ni descargas de la empresa.

`appConfig/metrics` contiene `metricsRefreshSeconds`, `dashboardPollSeconds`, `timeZone` y `currency`. Sus valores iniciales son 300 segundos, 60 segundos, `America/Santiago` y `CLP`. `metrics` guarda los resultados `overview` y `commercial`, sus variantes por rango y `generatedAt`. MAU considera uso en los últimos 30 días y la conversión se calcula sobre esos usuarios activos.

`serviceObservations` conserva las sondas HTTP del entorno configurado. `platforms` contiene información de versiones de prueba. Los documentos ficticios `services` y `containers` del cargador no sustituyen las mediciones: la operación real de desarrollo se consulta al laboratorio dedicado. `devMeta` identifica el conjunto de datos de prueba.

El código heredado también define `tutors`, `tutorReviews` y `tutorRequests`. Su presencia no amplía los 27 endpoints comprometidos para esta entrega administrativa.

## Cómo comprobar un cambio

1. Iniciar Docker según el [manual de arranque](../README.md).
2. Abrir el panel y ejecutar una operación con datos ficticios.
3. Abrir el visor y buscar el documento por el identificador devuelto por la API.
4. Comparar campos, estado y fecha. Para una recorrección confirmada, revisar también la notificación y el movimiento de medallas del alumno.
5. Consultar los registros de [pruebas y aceptación](04_PRUEBAS_Y_ACEPTACION.md). Las pruebas automáticas usan otra base y no aparecen en el visor de desarrollo.

## Referencias de implementación

Este inventario se contrastó con [el repositorio de datos](../backend/src/data/repo.js), [los datos ficticios](../backend/dev/fixtures.mjs), [usuarios y tickets](../backend/src/data/admin-support.js), [recorrecciones](../backend/src/data/corrections.js), [patrocinadores](../backend/src/data/sponsors.js), [catálogo de planes](../backend/src/services/plans/catalog.js) y [almacenamiento de métricas](../backend/src/services/metrics/store.js). El [diagrama de clases del dominio](20_DIAGRAMA_CLASES_DOMINIO.md) muestra sus relaciones principales.
