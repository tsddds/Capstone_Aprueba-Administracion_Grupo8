# Estado de Fase 2

Actualización documental del 28 de octubre de 2026. Corte técnico del 27 de octubre de 2026. Responsables: equipo Aprueba Administración.

## Implementación integrada

Los tres bloques se integraron en el repositorio de desarrollo sobre `a2b05bea`. Esta copia académica incorpora además las correcciones del cierre y la documentación grupal del 27/10. El historial de desarrollo se conserva en el repositorio de trabajo del equipo.

El entorno Docker ejecuta backend, frontend, Firestore y un laboratorio operativo dedicado. Los datos de desarrollo se conservan en un volumen. La regresión utiliza otro emulador y aprobó 214 pruebas; la compilación del cliente también terminó correctamente.

Las últimas correcciones incorporan la nota interna de recorrecciones, la reserva normalizada de correos, el disparador protegido de métricas y ajustes del cliente. La prueba de resolución guardó la nota y una recompensa de 250 medallas de bronce, con una notificación sin la nota interna.

## Seguimiento del equipo

La [planilla grupal](seguimiento/01_Seguimiento_Grupal_Fase2.xlsx) reúne los 27 endpoints, responsables, pruebas y revisión de pares. Las demás matrices mantienen backlog, riesgos, planificación, requisitos, inventario y defectos. Las guías individuales de preparación se retiraron del paquete actual después de consolidar sus instrucciones técnicas.

El [informe final](informe-final/2.6_Informe_Final_Proyecto_APT_Aprueba_Administracion.docx) describe el desarrollo y sus evidencias según la guía 2.6. El PPT conserva el corte de la presentación del 20/10.

## Pendientes de cierre

1. Obtener una cuenta sandbox autorizada y aceptar la sincronización de precios con Stripe.
2. Configurar y verificar la agenda remota de métricas y las URLs autorizadas de servicios empresariales.
3. Realizar revisión de pares y recepción del proyecto en los computadores de los compañeros.
4. Completar reflexiones individuales y confirmar competencias del informe.
5. Registrar acuerdos y fechas reales, revisar la publicación académica y entregar en la plataforma del curso.

La [guía de cierre](18_CIERRE_FASE2_Y_ENTREGA.md) contiene el procedimiento de cada punto. La causa del timeout histórico no quedó confirmada; las pruebas concurrentes actuales y tres repeticiones adicionales aprobaron. La búsqueda de correos heredados y las agregaciones de métricas requieren evaluación antes de escalar a producción.

## Evidencia

- [Resumen de ejecución](evidencias/cierre-2026-10-27/resumen.json).
- [Comandos y resultados](evidencias/cierre-2026-10-27/resultados.json).
- [Fuentes verificadas](evidencias/cierre-2026-10-27/fuente.json).
- [Persistencia de la prueba visual](evidencias/cierre-2026-10-27/persistencia-ui.json).

Los registros de ejecuciones anteriores conservan su fecha en `evidencias`. La revisión documental no repite ni altera sus resultados. Vercel y Firebase remoto permanecen sin cambios en esta intervención.
