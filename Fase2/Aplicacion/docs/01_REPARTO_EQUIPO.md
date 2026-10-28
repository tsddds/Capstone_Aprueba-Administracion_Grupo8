# Responsabilidades del equipo

Los tres integrantes programan backend, escriben pruebas y participan en la revisión. El reparto agrupa funciones relacionadas para reducir cambios simultáneos sobre un mismo módulo. Los ID y métodos se conservan en [el catálogo de 27 endpoints](endpoints.json).

## Tsung-Hao

Diez endpoints: E01 y E08–E16. Comprenden autenticación, plataformas, servicios, contenedores, usuarios y tickets.

Archivos principales: `backend/src/routes/auth.js`, `ops.js`, `users.js`, `tickets.js`, `backend/src/data/admin-support.js` y `admin-ops.js`. Los adaptadores operativos están en `backend/src/services/operations`. Pruebas: `a-sprint1`, `a-sprint2` y `a-ops`.

La revisión de este bloque se centra en permisos, validación de usuarios, unicidad de correo, auditoría, respuestas de soporte y operación restringida al laboratorio autorizado.

## Catalina

Diez endpoints: E04–E07 y E17–E22. Comprenden patrocinadores, beneficios, preguntas, importación y recorrecciones.

Archivos principales: `backend/src/routes/sponsors.js`, `questions.js`, `corrections.js`; repositorios correspondientes en `backend/src/data`; validadores e importador en `backend/src/lib`. Pruebas: suites `b-*`.

La revisión se centra en baja de beneficios conservando historial, paginación y filtros, alternativas válidas, explicaciones estructuradas, política de importación y resolución transaccional con recompensa única y aviso al alumno.

## Felipe

Siete endpoints: E02, E03 y E23–E27. Comprenden métricas, catálogo de funcionalidades, planes y sincronización de precios.

Archivos principales: `backend/src/routes/plans.js`, `metrics.js` y `backend/src/services/plans`, `billing` y `metrics`. Pruebas: `c-catalog`, `c-billing` y `c-metrics`.

La revisión se centra en referencias de funcionalidades, suscripciones activas, validación de precios, idempotencia del proveedor y cálculo de indicadores desde registros persistidos.

## Integración y revisión

Las estimaciones iniciales son A: 34 puntos, B: 33 y C: 35. Se utilizan como referencia relativa de complejidad. La planilla grupal conserva los responsables de cada endpoint.

Cada cambio debe incluir implementación, pruebas y actualización documental. Los cambios en autenticación, errores, ejecutor de pruebas y modelos compartidos requieren revisión de los consumidores afectados. El equipo acuerda capacidad y fechas reales en la planificación y registra los resultados de sus revisiones.

El cierre de una recorrección modifica medallas y notificaciones del alumno; los cambios de perfil deben preservar esos campos. Las métricas consumen fuentes de los tres módulos. Los acuerdos de integración están en [datos y contratos internos](03_DATOS_Y_CONTRATOS_INTERNOS.md).
