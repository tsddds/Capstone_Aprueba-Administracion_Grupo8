# Aprueba Administración

Proyecto Capstone del Grupo 8 de Ingeniería en Informática, Duoc UC, 2026. Integrantes: Tsung-Hao Liu, Catalina Padilla y Felipe Rojas.

**Estado al 28 de octubre de 2026: Fase 2 en desarrollo avanzado.** El equipo integró los tres bloques y comprobó la ejecución en Docker local. El corte del 27/10 registra 214 pruebas automatizadas aprobadas, sin fallos ni omisiones, y la compilación del cliente. La aceptación externa, la revisión del equipo y los diarios individuales siguen pendientes.

## Proyecto y alcance

La API centraliza acceso administrativo, métricas, patrocinadores, plataformas, servicios, contenedores, usuarios, tickets, recorrecciones, preguntas, funcionalidades y planes. El alcance son los 27 endpoints de la sección 4 del contrato original. La interfaz React permite demostrar las operaciones del backend. La aplicación del alumno y el generador quedan fuera de esta entrega.

El [contexto del proyecto](Fase2/Aplicacion/docs/22_CONTEXTO_Y_ALCANCE.md) reúne el problema, la justificación y los interesados. El propósito es aplicar permisos y reglas comunes a las operaciones administrativas y comprobar su persistencia; todavía no se ha medido un impacto comercial en la empresa.

## Documentación por fase

- [Fase 1](Fase1/Evidencias_grupales): definición, evidencias académicas, requisitos, historias, Scrum y arquitectura. Los archivos entregados mantienen su historia.
- [Product Vision](Fase1/Evidencias_grupales/anexo/01_Inicio/03_Product_Vision_Criterios_Exito.docx): actualización al alcance de 27 endpoints y cinco sprints, con fecha de revisión documental del 28/10.
- [Fase 2](Fase2/README.md): guía 2.4, informe 2.6 preparado, seis planillas, aplicación, pruebas, presentación y pendientes.

## Herramientas utilizadas

JavaScript, Node.js, Express, Firebase Admin SDK y Cloud Firestore para el backend; React y Vite para la demostración; Docker Compose y emuladores Firebase para desarrollo y pruebas; pruebas automatizadas con `node:test`; Git y GitHub para integración y documentación. Vercel aloja el despliegue previamente preparado; esta publicación académica no lo actualiza. Stripe se utiliza como integración de precios en modo de pruebas, con aceptación externa pendiente.

## Ejecución local

Requisitos: Git y Docker Desktop con motor Linux iniciado. No se necesitan credenciales de Firebase remoto para el entorno local. Desde una terminal:

```powershell
git clone https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8.git
cd Capstone_Aprueba-Administracion_Grupo8/Fase2/Aplicacion
docker compose -f compose.yaml -f compose.ops.yaml --profile ui up -d --build
docker compose -f compose.yaml -f compose.ops.yaml ps
```

Abrir la aplicación en http://localhost:5173, la API en http://localhost:4000/health y el visor de datos en http://localhost:4001/firestore. Las cuentas ficticias están indicadas en el login. Desarrollo utiliza `demo-aprueba-equipo`, con volumen persistente. Las pruebas usan `demo-aprueba-tests`, separado. La semilla conserva los documentos existentes. No ejecutar ambos repositorios a la vez con los mismos puertos.

Para detener el proyecto sin borrar sus datos:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml stop
```

El laboratorio incluye un puente con acceso al daemon Docker, restringido al contenedor de pruebas autorizado. Debe ejecutarse únicamente en desarrollo local; sus límites están en [el manual de operación](Fase2/Aplicacion/docs/03_DATOS_Y_CONTRATOS_INTERNOS.md#laboratorio-operativo).

## Pruebas y calidad

El [resumen del 27/10](Fase2/Aplicacion/docs/evidencias/cierre-2026-10-27/resumen.json) y los [resultados por comando](Fase2/Aplicacion/docs/evidencias/cierre-2026-10-27/resultados.json) conservan el registro de ejecución. Hay pruebas de permisos, validación, persistencia, concurrencia e integración. El total incluye escenarios compartidos entre suites y no equivale a cobertura completa.

Para repetir la verificación conjunta, con Node.js instalado además de Docker, ejecutar desde `Fase2/Aplicacion`:

```powershell
node backend/dev/verify-phase2.mjs --output .local/verificacion-equipo
```

Usar una carpeta de salida nueva. La [guía de pruebas](Fase2/Aplicacion/docs/04_PRUEBAS_Y_ACEPTACION.md) también explica las suites por separado. Los resultados de Stripe usan un proveedor simulado; falta la comprobación en sandbox externo.

## Equipo y metodología

Los tres integrantes desarrollan backend, con módulos relacionados para reducir cambios simultáneos sobre los mismos archivos:

- Tsung-Hao: autenticación, usuarios, soporte, plataformas y operación; 10 endpoints.
- Catalina: patrocinadores, preguntas y recorrecciones; 10 endpoints.
- Felipe: funcionalidades, planes y métricas; 7 endpoints.

Scrum organiza el trabajo en cinco sprints. El [plan de sprints](Fase2/Aplicacion/docs/02_SPRINTS_Y_BACKLOG.md), el Product Backlog y el [seguimiento grupal](Fase2/Aplicacion/docs/seguimiento/README.md) reúnen tareas, responsables y criterios. La Definition of Done requiere pruebas, documentación y revisión de otro integrante. Las aprobaciones y retrospectivas se registran cuando ocurren.

## Arquitectura y datos

El cliente React realiza solicitudes a Express. Las rutas aplican autenticación, permisos y validación; los módulos de negocio coordinan las operaciones y acceden a Firestore mediante Firebase Admin SDK. Las integraciones de métricas, precios y operación se mantienen separadas. Docker ejecuta el cliente, el backend, el emulador y el laboratorio dedicado.

El [modelo de datos Firestore](Fase2/Aplicacion/docs/19_MODELO_DATOS_FIRESTORE.md) describe colecciones, referencias y transacciones. El [diagrama de clases del dominio](Fase2/Aplicacion/docs/20_DIAGRAMA_CLASES_DOMINIO.md) representa sus relaciones principales. La [explicación del aporte](Fase2/Aplicacion/docs/21_INNOVACION_Y_APORTE.md) vincula las funciones con su evidencia local.

## Próximos pasos

Completar los tres diarios individuales 2.1; realizar revisión de pares y recepción en los computadores de los compañeros; aceptar Stripe sandbox; configurar y verificar la agenda remota y los servicios autorizados; revisar el informe y registrar la entrega académica. Los pasos están en [cierre y entrega](Fase2/Aplicacion/docs/18_CIERRE_FASE2_Y_ENTREGA.md). Publicar el avance no equivale a cerrar la fase ni a aprobar la evaluación.
