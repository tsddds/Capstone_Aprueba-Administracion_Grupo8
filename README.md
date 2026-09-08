# Aprueba Administración Backend

Proyecto Capstone del Grupo 8 de Ingeniería en Informática, Duoc UC, año 2026.

**Estado actual:** definición y planificación de Fase 1. Este repositorio reúne las evidencias académicas del equipo. La API funcionando, las pruebas ejecutadas y el despliegue son resultados esperados de las fases de desarrollo, no resultados ya realizados.

## Descripción del proyecto

El proyecto consiste en desarrollar el backend de Aprueba Administración. Está dirigido a los usuarios que administran el negocio y realizan labores de soporte, finanzas y operación. Busca centralizar las operaciones administrativas, aplicar reglas de negocio y controlar el acceso a la información mediante validaciones y permisos.

El alcance comprende los **27 endpoints `/admin` de la sección 4, Consola de administración, de `Aprueba_API_Backend.docx`**, junto con las convenciones generales necesarias de respuestas, errores, autenticación, autorización, paginación y validación.

Las operaciones abarcan acceso administrativo, métricas, patrocinadores, plataformas, servicios, contenedores, usuarios, tickets de soporte, correcciones, preguntas, funcionalidades y planes. El documento funcional de referencia no se publica en este repositorio.

No se incluye la aplicación del alumno, su sitio web, el generador ni un frontend administrativo completo. Si es necesario, se podrá crear una interfaz mínima para demostrar la API. La entrega y validación se concentrarán en el backend y estarán a cargo del docente.

## Tecnologías utilizadas

- **Control de versiones y repositorio académico:** Git y GitHub.
- **Interfaz definida por el contrato:** API HTTP con intercambio de datos JSON.
- **Lenguaje de programación y framework:** pendientes de recibir y revisar el repositorio vigente.
- **Base de datos:** será entregada posteriormente por la empresa o el docente; el sistema y los accesos están pendientes.
- **Nube y servicios externos:** pendientes de confirmación.
- **Herramientas de pruebas, automatización y despliegue:** se definirán conforme al entorno vigente y a los requisitos académicos.

El código antiguo no se considera evidencia del estado actual. Tampoco se presenta ningún proveedor o tecnología de infraestructura como una decisión ya confirmada.

## Ejecución local

**La ejecución de la API está pendiente.** Este repositorio todavía no contiene una versión vigente y ejecutable del backend, por lo que no dispone de comandos de instalación, arranque o pruebas verificados.

Para descargar las evidencias, se necesita Git instalado:

```bash
git clone https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8.git
cd Capstone_Aprueba-Administracion_Grupo8
```

Estos comandos descargan la documentación; **no ponen en marcha la API**.

Cuando se reciba el repositorio vigente, esta sección se completará con los requisitos y versiones, la instalación de dependencias, la configuración de variables de entorno, la conexión a una base de pruebas, los comandos exactos de arranque y pruebas, y la dirección local para verificar el funcionamiento. También se documentará el procedimiento de contenedores requerido por el instructivo o la alternativa que acepte expresamente el docente.

Las credenciales y los datos reales no deben publicarse. La configuración de ejemplo deberá contener únicamente nombres de variables y valores ficticios.

## Integrantes y roles

La distribución corresponde a responsabilidades planificadas. Los tres integrantes colaborarán en el desarrollo del backend y combinarán funciones según las necesidades del proyecto.

- **Tsung-Hao Liu:** gestión del proyecto y facilitación de Scrum; desarrollo de la API, autenticación, autorización y seguridad; participación en integración y despliegue.
- **Catalina Yanara Padilla Astudillo:** Product Owner y análisis de negocio; definición de requisitos, priorización del backlog, criterios de aceptación y documentación.
- **Felipe Antonio Rojas Riffo:** arquitectura y datos; calidad y automatización de pruebas; gestión de configuración y versiones, integración y preparación del despliegue.

Las responsabilidades detalladas se encuentran en las hojas de roles y RACI del [plan de trabajo y Carta Gantt](Fase1/Evidencias_grupales/03_Plan_Trabajo_Carta_Gantt_y_RACI.xlsx).

## Metodología de trabajo

El equipo utilizará Scrum para desarrollar y revisar la API mediante incrementos. El Product Backlog será la lista priorizada del trabajo. En cada sprint se definirá un objetivo, se seleccionarán las tareas, se desarrollará y probará el incremento, se revisarán los resultados y se realizará una retrospectiva.

La planificación contempla **18 semanas**:

- **Semanas 1 a 4:** definición, requisitos, diseño y preparación del trabajo.
- **Semanas 5 a 15:** cinco sprints de desarrollo incremental del backend.
- **Semanas 16 a 18:** estabilización, despliegue, transición, demostración y defensa.

La Carta Gantt complementa la planificación con tiempos, dependencias y responsables. La calidad, la seguridad, los riesgos y la documentación se gestionarán durante todo el proyecto. Los resultados de pruebas y los acuerdos de revisión se registrarán cuando ocurran.

## Arquitectura de la solución

La arquitectura propuesta separa tres responsabilidades: la entrada HTTP que recibe las solicitudes, los servicios que aplican las reglas del negocio y los permisos, y la capa de acceso a datos que se conectará con la base entregada por la contraparte.

Por ejemplo, una consulta administrativa deberá comprobar la identidad y los permisos del solicitante, validar los parámetros, recuperar la información autorizada y devolver una respuesta conforme al contrato. La gestión de errores, el registro de operaciones y la protección de credenciales se aplicarán de forma transversal.

El acceso a datos y a servicios externos se organizará mediante componentes de conexión separados de la lógica del negocio. Esta es una propuesta de diseño, no una descripción verificada del código vigente. Su implementación concreta se ajustará al recibir los insumos técnicos.

## Evidencias de Fase 1

La carpeta [Evidencias grupales](Fase1/Evidencias_grupales) contiene únicamente:

1. [Plan de trabajo, Carta Gantt y RACI](Fase1/Evidencias_grupales/03_Plan_Trabajo_Carta_Gantt_y_RACI.xlsx).
2. [Presentación de Fase 1](Fase1/Evidencias_grupales/02_Presentacion_Proyecto_Fase1_Aprueba_Administracion.pptx), versión corregida de 11 diapositivas.
3. [APT Formativa Fase 1](Fase1/Evidencias_grupales/1.4_APT122_FormativaFase1.docx).
4. [Guía de estudiante y definición del proyecto APT](Fase1/Evidencias_grupales/1.5_GuiaEstudiante_Fase%201_Definicion%20Proyecto%20APT.docx).
5. [Planilla de evaluación Fase 1](Fase1/Evidencias_grupales/PLANILLA%20DE%20EVALUACI%C3%93N%20FASE%201.xlsx).

Las autoevaluaciones y los diarios de reflexión de cada integrante se encuentran en [Evidencias individuales](Fase1/Evidencias_individuales).

## Resultado esperado

Al finalizar el proyecto se espera una API administrativa funcionando, entornos de prueba y producción, pruebas automatizadas y una demostración mediante solicitudes reproducibles. La evaluación corresponderá al docente. En Fase 1 se presenta la definición y planificación necesarias para avanzar hacia ese resultado.
