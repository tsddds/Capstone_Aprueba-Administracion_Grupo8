# Aprueba Administración — Backend

Proyecto CAPSTONE del Grupo 8, Ingeniería en Informática, Duoc UC, sede Plaza Oeste. Año 2026.

**Estado:** definición y planificación de Fase 1. La API operativa, las pruebas ejecutadas y el despliegue son resultados esperados del desarrollo; no se presentan como terminados.

Repositorio académico: [tsddds/Capstone_Aprueba-Administracion_Grupo8](https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8).

## Descripción del proyecto

Desarrollaremos el backend que permitirá administrar las operaciones del negocio de Aprueba. Está dirigido a los usuarios de administración, soporte, finanzas y operaciones. La solución busca centralizar el acceso a la información y aplicar reglas, validaciones y permisos consistentes para gestionar el negocio.

El alcance confirmado comprende los **27 endpoints `/admin` de la sección 4, «Consola de administración», de `Aprueba_API_Backend.docx`** y las convenciones generales necesarias para implementarlos: respuestas, errores, autenticación, autorización, paginación y validación.

Las funciones incluyen autenticación administrativa; métricas generales y comerciales; patrocinadores; consulta de plataformas, servicios y contenedores y solicitudes de reinicio; usuarios; tickets de soporte; correcciones; preguntas e importación; funcionalidades y planes.

No incluye la aplicación del alumno, su sitio web, el generador ni un frontend administrativo completo. Se podrá utilizar una interfaz mínima como apoyo a la demostración, sin convertirla en el producto principal. La base de datos será entregada posteriormente por la contraparte y no requiere coordinación con otros equipos.

## Tecnologías utilizadas y pendientes

- **Control de versiones y evidencias:** Git y GitHub.
- **Contrato de la solución:** API HTTP con intercambio de datos JSON y las reglas de seguridad definidas en la especificación.
- **Lenguaje, framework y versiones:** pendientes de recibir y revisar el repositorio vigente.
- **Base de datos y controlador de conexión:** pendientes de la entrega de la base, la cuenta y sus accesos.
- **Nube, servicios externos y mecanismo de despliegue:** pendientes de confirmación.
- **Herramientas de pruebas y automatización:** pendientes de la definición del entorno técnico vigente.

El código antiguo no se utiliza para afirmar cuáles son las tecnologías actuales ni el estado de implementación. Los endpoints de administración de contenedores tampoco demuestran por sí solos que esta API esté desplegada con Docker.

El instructivo CAPSTONE, en su anexo técnico de las páginas 15 y 16, contempla Dockerfile, Docker Compose, variables de entorno e instrucciones para levantar el sistema. Su implementación académica está pendiente; debe alinearse con el entorno que se entregue o con una alternativa expresamente aceptada por el docente. No se declara Docker implementado ni confirmado como infraestructura de la empresa.

## Ejecución local

**Por ahora este repositorio contiene evidencias académicas; no incluye una versión vigente y ejecutable del backend.** No existen comandos de instalación y arranque verificados que se puedan indicar responsablemente.

Para obtener la documentación, con Git instalado:

```bash
git clone https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8.git
cd Capstone_Aprueba-Administracion_Grupo8
```

Estos comandos descargan los documentos, pero **no inician la API**.

Cuando se reciban los insumos vigentes, se completará este apartado con:

1. Requisitos de software y versiones compatibles.
2. Instalación de dependencias con el gestor correspondiente.
3. Configuración a partir de un ejemplo de variables de entorno sin secretos.
4. Conexión a una base de pruebas con datos autorizados.
5. Comandos exactos de arranque, dirección local y comprobación de funcionamiento.
6. Comandos para ejecutar las pruebas automatizadas y consultar sus resultados.
7. Procedimiento de contenedores o alternativa académica acordada, apagado y resolución de problemas.

El [manual técnico](Fase1/Evidencias_grupales/Anexos/05_Calidad_Pruebas_y_Despliegue/03_Manual_Tecnico_y_Ejecucion_Borrador.docx) sigue siendo un borrador hasta verificar esos pasos en el entorno vigente. No deben publicarse credenciales, tokens, archivos `.env` con valores reales ni copias de la base de datos.

## Integrantes y roles

La distribución inicial combina funciones porque el equipo está formado por tres integrantes. Describe responsabilidades planificadas, no trabajo ya ejecutado.

- **Tsung-Hao Liu:** gestión del proyecto y facilitación de Scrum; desarrollo backend y API; autenticación, autorización y seguridad. Participación en integración y despliegue.
- **Catalina Yanara Padilla Astudillo:** Product Owner y análisis de negocio; requisitos, prioridades del backlog, criterios de aceptación y documentación técnica.
- **Felipe Antonio Rojas Riffo:** arquitectura de solución y datos; QA y automatización de pruebas; configuración, versiones y preparación operativa. Participación en integración y despliegue.

Los tres colaborarán en los incrementos. La distribución completa de responsabilidades se encuentra en las hojas Roles y RACI de la [Carta Gantt y plan de trabajo](Fase1/Evidencias_grupales/03_Plan_Trabajo_Carta_Gantt_y_RACI.xlsx).

## Metodología de trabajo

El equipo utilizará Scrum con un Product Backlog priorizado, objetivos por sprint y una Definition of Done. Cada sprint incluirá planificación, seguimiento, refinamiento del backlog, revisión, retrospectiva y pruebas. La gestión de riesgos, cambios, calidad y documentación será transversal.

La planificación del proyecto contempla 18 semanas:

- Semanas 1 a 4: definición, requisitos, arquitectura y preparación.
- Semanas 5 a 15: cinco sprints de desarrollo incremental del backend.
- Semanas 16 a 18: estabilización, despliegue, transición, demostración y defensa.

El [dossier de gestión ágil](Fase1/Evidencias_grupales/Anexos/03_Gestion_Agil/01_Dossier_Gestion_Agil_Fase1.docx) incluye los eventos y la Definition of Done. Los [backlogs](Fase1/Evidencias_grupales/Anexos/03_Gestion_Agil/02_Backlogs_RAID_Decisiones_y_Cambios.xlsx) contienen la planificación inicial. Los resultados, acuerdos de retrospectivas y cambios se registrarán cuando ocurran; no son evidencias de sprints ya realizados.

## Arquitectura de la solución

La propuesta lógica separa la recepción de solicitudes HTTP, los controles de autenticación y autorización, los servicios con reglas del negocio y el acceso a datos mediante adaptadores. Las integraciones externas se mantendrán desacopladas hasta conocer sus contratos y accesos. La configuración segura, los errores y la trazabilidad afectan a todas las capas.

Este es un diseño propuesto, no una descripción verificada del código actual. El modelo lógico se ajustará al sistema de base de datos que entregue la contraparte.

Véanse el [dossier de ingeniería](Fase1/Evidencias_grupales/Anexos/04_Ingenieria_y_Arquitectura/01_Dossier_Ingenieria_Software_Fase1.docx) y los [diagramas de contexto, componentes, casos de uso, secuencia, despliegue y datos](Fase1/Evidencias_grupales/Anexos/04_Ingenieria_y_Arquitectura/Diagramas).

## Documentos de Fase 1

Archivos principales en [Evidencias grupales](Fase1/Evidencias_grupales):

- [Informe formativo 1.4](Fase1/Evidencias_grupales/1.4_APT122_FormativaFase1.docx).
- [Guía del estudiante 1.5 y definición del proyecto](Fase1/Evidencias_grupales/1.5_GuiaEstudiante_Fase%201_Definicion%20Proyecto%20APT.docx).
- [Plan de trabajo, Carta Gantt y RACI](Fase1/Evidencias_grupales/03_Plan_Trabajo_Carta_Gantt_y_RACI.xlsx).
- [Presentación de Fase 1](Fase1/Evidencias_grupales/02_Presentacion_Proyecto_Fase1_Aprueba_Administracion.pptx), versión simplificada de 11 diapositivas con notas del expositor.

En [Anexos](Fase1/Evidencias_grupales/Anexos) se incluyen gestión ágil, requisitos y trazabilidad, diseño, diagramas, planificación de pruebas, manual técnico en borrador y registro de fuentes. La planilla de evaluación se conserva como instrumento académico, no como prueba de aprobación.

Las [evidencias individuales](Fase1/Evidencias_individuales) se mantienen separadas y son responsabilidad de cada integrante. Esta actualización de documentación grupal no modifica ni valida las respuestas individuales existentes.

## Resultados esperados y pendientes de completitud

Al finalizar el proyecto se espera una API administrativa funcionando, entornos de prueba y producción, pruebas automatizadas, documentación y demostración mediante solicitudes. El docente recibirá y evaluará el resultado.

La revisión del instructivo identifica trabajo que no debe confundirse con evidencia terminada:

- Consolidar una Product Vision identificable; actualmente el problema, los usuarios y el valor propuesto se describen en los documentos de definición.
- Completar decisiones técnicas y el modelo de datos físico al recibir los insumos vigentes.
- Resolver el apartado académico de Docker y completar la ejecución local reproducible.
- Incorporar explícitamente casos de rendimiento, cargas de prueba y criterios medibles al plan de pruebas; la planificación actual no los desarrolla como un nivel independiente.
- Registrar avances reales por sprint, retrospectivas y resultados de pruebas unitarias, integración, rendimiento y seguridad durante el desarrollo.
- Completar el manual final, evidencias de despliegue, informes de avance y cierre, y la sección de innovación solicitada para el informe final.

Referencia académica: *Instructivo CAPSTONE 2026.pdf*, apartado 11 sobre inglés, anexo de artefactos de las páginas 14 a 17 y anexo GitHub de las páginas 17 y 18. El repositorio académico debe mantenerse accesible y activo hasta la semana 18. La publicación de evidencias no autoriza divulgar código, datos o documentos internos de la contraparte.
