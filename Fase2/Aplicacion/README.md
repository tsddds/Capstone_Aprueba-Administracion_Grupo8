# Aprueba Administración

Backend administrativo desarrollado por Tsung-Hao, Catalina y Felipe para gestionar usuarios, soporte, patrocinadores, preguntas, planes, métricas y operación de Aprueba.

El proyecto utiliza JavaScript, Node.js, Express y Firestore. El cliente React/Vite permite demostrar las funciones. El alcance comprende los 27 endpoints administrativos de la sección 4 del contrato original.

## Ejecutar el proyecto

Con Docker Desktop iniciado, ejecutar desde esta carpeta:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile ui up -d --build
docker compose -f compose.yaml -f compose.ops.yaml ps
```

- Aplicación: http://localhost:5173
- API: http://localhost:4000/health
- Visor de la base local: http://localhost:4001/firestore

El login muestra las cuentas ficticias del emulador. Desarrollo usa `demo-aprueba-equipo`, con datos persistentes; las pruebas usan `demo-aprueba-tests`, una base descartable separada. El entorno local funciona sin credenciales de Firebase remoto. Evitar `down -v` para conservar los cambios de desarrollo.

## Documentación del equipo

- [Estado y pendientes](docs/00_CONTROL_FASE2.md).
- [Responsabilidades por módulo](docs/01_REPARTO_EQUIPO.md).
- [Plan de sprints](docs/02_SPRINTS_Y_BACKLOG.md).
- [Datos y contratos internos](docs/03_DATOS_Y_CONTRATOS_INTERNOS.md).
- [Pruebas y aceptación](docs/04_PRUEBAS_Y_ACEPTACION.md).
- [Inicio en otro computador](docs/05_GUIA_INICIO_EQUIPO.md).
- [Uso del visor Firestore](docs/06_VISOR_BASE_LOCAL.md).
- [Seguimiento grupal](docs/seguimiento/README.md).
- [Informe final de Fase 2](docs/informe-final/2.6_Informe_Final_Proyecto_APT_Aprueba_Administracion.docx).
- [Validaciones externas y entrega](docs/18_CIERRE_FASE2_Y_ENTREGA.md).

## Modelo y aporte

- [Modelo de datos Firestore](docs/19_MODELO_DATOS_FIRESTORE.md).
- [Diagrama de clases del dominio](docs/20_DIAGRAMA_CLASES_DOMINIO.md).
- [Aporte del proyecto](docs/21_INNOVACION_Y_APORTE.md).

## Verificación

El corte del 27/10/2026 registra 214 pruebas aprobadas, cero fallos y cero omitidas, además de la compilación del cliente. Los registros están en [evidencias de cierre](docs/evidencias/cierre-2026-10-27/resumen.json). Las suites comparten algunos escenarios; el total no mide cobertura de líneas.

Para repetir la verificación completa con Node instalado en el equipo:

```powershell
node backend/dev/verify-phase2.mjs --output .local/verificacion-equipo
```

Usar un directorio de salida nuevo. También se pueden ejecutar las suites individualmente con Docker según la guía de pruebas.

La aceptación de Stripe sandbox, la operación remota y la revisión del equipo continúan pendientes. Este paquete académico incorpora el corte integrado del 27/10/2026. Su publicación no despliega cambios en Vercel ni modifica Firebase remoto.
