# Contexto y alcance del proyecto

Aprueba Administración es el proyecto de backend del Grupo 8 de Ingeniería en Informática. El producto responde a la necesidad de disponer de operaciones administrativas con permisos, validación de datos y respuestas uniformes para negocio, soporte, contenido y operación.

## Problema que se aborda

El contrato de la consola reúne consultas y cambios sobre usuarios, tickets, preguntas, patrocinadores, planes e indicadores. Implementar cada acción sin reglas comunes podría producir accesos indebidos, referencias inconsistentes o resultados difíciles de comprobar. El proyecto concentra esas operaciones en una API y establece controles compartidos de autenticación, autorización, validación y errores.

Esta formulación expresa la necesidad técnica del encargo. No afirma que se haya medido una tasa de errores ni que se haya auditado un procedimiento interno de la empresa.

## Justificación

La solución permite gestionar las operaciones del contrato a través de un backend común y verificar cambios en una base persistente. Los controles transaccionales resultan relevantes para acciones relacionadas, como resolver una recorrección y emitir su premio o modificar un plan y comprobar sus referencias. El entorno local facilita probar esas reglas con información ficticia sin afectar el despliegue.

Para el proyecto académico, el desarrollo aplica análisis de requisitos, programación, datos, seguridad, pruebas, integración y gestión del trabajo. Las pruebas y la documentación son evidencia del desarrollo local. La utilidad empresarial requiere revisión y aceptación de la contraparte; no se ha cuantificado un ahorro ni un impacto comercial.

## Objetivo y límites

Implementar los 27 endpoints administrativos de la sección 4 del contrato original, con persistencia en Firestore y las convenciones generales necesarias de autenticación, permisos, paginación, respuestas y validación. El trabajo conserva JavaScript, Node.js y Express. React/Vite aporta la interfaz de demostración.

Se incluyen las funciones de acceso, métricas, patrocinadores, plataformas, supervisión, contenedores, usuarios, soporte, recorrecciones, preguntas, funcionalidades y planes. La aplicación del alumno y el generador no forman parte del alcance comprometido. Los datos de negocio son ficticios. La operación se demuestra en Docker local autorizado y los precios requieren aceptación en un proveedor de pruebas.

## Interesados y responsabilidades

- La contraparte de Aprueba define las necesidades del negocio y las condiciones de aceptación e integración de su entorno.
- El docente revisa las evidencias y evalúa los entregables académicos.
- Tsung-Hao Liu, Catalina Padilla y Felipe Rojas desarrollan, integran, prueban y documentan los módulos acordados.
- Los perfiles administrativos de finanzas, soporte y operación son los usuarios objetivo de las funciones autorizadas.
- Los alumnos se vinculan a tickets, perfiles y recorrecciones. La notificación de una resolución se almacena dentro de la aplicación; los datos usados en las pruebas no corresponden a alumnos reales.

## Avance y aceptación

La implementación integrada dispone de evidencia local del 27 de octubre de 2026: 214 pruebas aprobadas y compilación del cliente. La publicación académica del avance no acredita aceptación del equipo, de la empresa ni del docente. Siguen pendientes Stripe externo, validación remota, revisión de pares, recepción en otros computadores y los diarios individuales.

La visión del producto de Fase 1 presenta los resultados esperados. Los [requisitos y el seguimiento](seguimiento/README.md), el [reparto](01_REPARTO_EQUIPO.md) y la [guía de cierre](18_CIERRE_FASE2_Y_ENTREGA.md) detallan la implementación y los pendientes. Los antecedentes académicos se encuentran en la Guía 1.5 y en la Formativa 1.4 de Fase 1.
