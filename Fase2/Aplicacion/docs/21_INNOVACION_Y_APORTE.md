# Aporte del proyecto

Aprueba Administración reúne en una API las operaciones de usuarios, soporte, patrocinadores, contenido, planes y supervisión. El aporte consiste en implementar reglas del negocio sobre un contrato común, con controles de acceso y evidencia que permite comprobar los cambios. Se trata de una solución aplicada al caso Aprueba; no se presenta como una tecnología inédita ni como una mejora de productividad ya medida en la empresa.

## Resolución de recorrecciones

La confirmación coordina el estado de la solicitud, el eventual cambio de pregunta, el saldo de bronce, el movimiento de medallas y una notificación dentro de la aplicación. La transacción y la comprobación del estado evitan otorgar nuevamente el premio al repetir la solicitud. La nota interna queda separada del aviso al alumno.

La evidencia local incluye una resolución confirmada y la lectura posterior de sus documentos. Las suites también cubren rechazos, permisos, referencias inválidas y resolución concurrente. Véanse [la implementación](../backend/src/data/corrections.js), [las pruebas](../backend/test/integration/b-corrections-resolve.test.mjs) y [la persistencia observada](evidencias/cierre-2026-10-27/persistencia-ui.json).

## Contenido que conserva su estructura

El banco admite explicaciones estructuradas, además del formato de texto heredado. La edición conserva los campos omitidos y la importación informa duplicados y errores por fila. Las preguntas importadas quedan en borrador para revisión. Esto permite cargar contenido sin publicarlo automáticamente.

El comportamiento se encuentra en [validación de preguntas](../backend/src/lib/question-validation.js), [importación](../backend/src/data/question-import.js) y sus [pruebas](../backend/test/integration/b-questions-import.test.mjs).

## Datos de prueba y supervisión comprobable

Docker separa la base de trabajo de la base descartable de pruebas. El visor Firestore permite observar los cambios sin intervenir la base remota. La operación utiliza sondas HTTP y un contenedor dedicado cuyo reinicio puede contrastarse con el cambio de su fecha de inicio. Los estados ficticios del cargador no se presentan como mediciones reales.

Esta preparación facilita la reproducción técnica del proyecto. No se ha medido una reducción de costos ni se ha validado la disponibilidad de los servicios empresariales. El [laboratorio](03_DATOS_Y_CONTRATOS_INTERNOS.md#laboratorio-operativo) y las [pruebas operativas](../backend/test/integration/a-ops.test.mjs) documentan el alcance local.

## Precios y aceptación externa

El catálogo prepara la sincronización de precios con un proveedor de pruebas y registra una operación idempotente antes de guardar el resultado. La regresión comprueba el comportamiento frente a respuestas y fallos de un proveedor simulado. Falta aceptar un cambio contra Stripe sandbox con una cuenta autorizada. Esa comprobación es parte del trabajo pendiente y no un beneficio demostrado.

## Resultado observado

El corte del 27 de octubre de 2026 reúne 214 ejecuciones automatizadas aprobadas y la compilación del cliente. El [registro de resultados](evidencias/cierre-2026-10-27/resumen.json) respalda el funcionamiento local comprobado. La revisión de pares, la recepción en otros computadores y las integraciones externas continúan abiertas. Las conclusiones sobre uso empresarial requieren esa validación posterior.
