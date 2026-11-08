# Cierre técnico y entrega

Actualización del 8 de noviembre de 2026. La verificación local aprobó 214 pruebas, sin fallos ni omisiones, y la compilación del cliente. La tercera evaluación se realiza el 25 de noviembre. La defensa de título corresponde a diciembre, con día por confirmar.

## Ejecutar el proyecto

Abrir Docker Desktop y una terminal en la carpeta de la aplicación. En este computador se encuentra en `DESARROLLO_FASE2_APRUEBA_ADMIN`; en el repositorio académico, en `Fase2/Aplicacion`.

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile ui up -d --build
docker compose -f compose.yaml -f compose.ops.yaml ps
```

- Aplicación: http://localhost:5173
- Salud de la API: http://localhost:4000/health
- Visor Firestore: http://localhost:4001/firestore

Las cuentas ficticias aparecen en la pantalla de acceso. Los datos del panel se conservan en un volumen. Las pruebas usan `demo-aprueba-tests`, separado de `demo-aprueba-equipo`.

Para detener la demostración y conservar los datos:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile ui stop
```

Para volver a iniciarla, repetir el comando `up`. Un reinicio del backend carga cambios que el watcher no detecte en Windows:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml restart backend
```

## Repetir las pruebas

```powershell
node backend/dev/verify-phase2.mjs --output .local/verificacion-equipo
```

Elegir otra carpeta si ese resultado ya existe. El procedimiento ejecuta las suites secuencialmente y conserva los logs cuando una falla. La evidencia del 08/11 está en [verificacion-2026-11-08](evidencias/verificacion-2026-11-08/resumen.json). Los registros y capturas del 27/10 conservan su fecha.

GitHub Actions completó la verificación del 08/11 con 214 pruebas aprobadas y compilación correcta. La [ejecución remota](https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8/actions/runs/42493493185) permite consultar los pasos y descargar los resultados. El [registro](evidencias/verificacion-2026-11-08/ejecucion-github.json) identifica el commit y las fuentes comprobadas.

## Revisar los precios

La suite `c-billing` verifica cambio de precio, fallo del proveedor, reintento e idempotencia con un proveedor simulado. Sus cinco pruebas están aprobadas en el registro del 08/11. La simulación se inyecta en las pruebas automatizadas. El adaptador de la aplicación conserva su configuración de proveedor externo; un cambio de precio desde el panel sin ese proveedor puede responder con error de configuración. Para la presentación, usar el registro de `c-billing` como evidencia de esta función.

## Comprobar el entorno remoto

La versión local verificada y el despliegue de Vercel tienen que identificarse por separado. Antes de actualizar el despliegue, el equipo debe confirmar el proyecto y la rama de producción.

1. En Vercel, abrir el proyecto backend y comprobar qué commit está desplegado. Revisar Root Directory y variables privadas. El frontend usa la URL de esa API.
2. Configurar `CRON_SECRET` en el backend con un valor aleatorio privado de al menos 32 caracteres. No reutilizar `JWT_SECRET` ni incluirlo en el cliente o el repositorio.
3. Revisar la frecuencia admitida por el plan de Vercel. En Hobby, el cron puede ejecutarse una vez al día. Si el proyecto requiere el intervalo local de cinco minutos, acordar un programador compatible y mantenerlo coherente con `appConfig/metrics.metricsRefreshSeconds`.
4. La ruta operativa es `GET /internal/metrics/refresh`. Vercel envía `Authorization: Bearer <CRON_SECRET>` a sus cron. Configurar el horario en `backend/vercel.json` solamente después de acordarlo y conservar sus otras propiedades.
5. Tras desplegar, comprobar `/health`, inicio de sesión y una lectura de datos de prueba. Verificar dos ejecuciones programadas y la actualización de `generatedAt` en los documentos de métricas, incluyendo una ejecución sin abrir el panel.
6. Registrar fecha, commit, URL y resultados sin secretos. Las URLs de servicios empresariales requieren destinos autorizados. El reinicio de contenedores sigue restringido al laboratorio Docker local.

Referencias de configuración: [frecuencias de cron en Vercel](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) y [autorización de cron](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).

## Revisión del equipo

1. Cada integrante ejecuta el proyecto en su computador y anota fecha, sistema, comandos y resultado en el seguimiento existente.
2. Revisar los módulos entre compañeros. Catalina revisa usuarios y soporte de Tsung-Hao; Felipe revisa patrocinadores, preguntas y recorrecciones de Catalina; Tsung-Hao revisa planes y métricas de Felipe. El responsable de cada módulo participa en la revisión de los hallazgos.
3. En `01_Seguimiento_Grupal_Fase2.xlsx`, registrar la revisión en la columna G. Las pruebas aprobadas mantienen el estado «Revisión pendiente» hasta que el equipo la realice.
4. Reunir los diarios 2.1 de Catalina y Felipe. Revisar las conclusiones y reflexiones del informe 2.6. Las competencias están vinculadas al perfil de egreso recibido. El abstract grupal está incorporado en español e inglés.
5. Registrar los acuerdos de revisión y retrospectiva que efectivamente se realicen. Las rúbricas docentes y las calificaciones las completa quien corresponda.

## Preparación del 25 de noviembre

1. Abrir el PPT de Fase 3 y comprobar el orden de la exposición. El PPT de evaluación 2 conserva su corte anterior.
2. Repartir las intervenciones: Tsung-Hao explica contexto, arquitectura y ejecución; Catalina, datos, trabajo grupal y funciones de contenido y soporte; Felipe, planes, métricas, resultados y pendientes. Todos deben poder responder sobre el conjunto.
3. Ensayar el arranque y tres recorridos: acceso y edición de un usuario ficticio; creación o edición de una pregunta; resolución de una recorrección con persistencia y aviso al alumno. Usar registros nuevos para cada ensayo y conservar las capturas como respaldo.
4. Cronometrar la exposición y completar la autoevaluación 3.2 después del ensayo. Confirmar con el docente duración, idioma y documentos de esta evaluación. Las guías 3.3 y 3.4 citadas en el instructivo no están entre los archivos recibidos.
5. Revisar los diarios 3.1 personales. La reflexión corresponde a cada integrante.
6. Revisar los archivos publicados, cargar los entregables en AVA y guardar el comprobante. El 25/11 registrar la retroalimentación y trasladar las correcciones a la preparación de la defensa de diciembre.

## Recuperación de la demostración

Si el panel no carga, comprobar primero `docker compose ... ps`, `/health` y los logs de backend y frontend. Reiniciar únicamente el servicio que falló. Para cambiar de versión, conservar los cambios locales, seleccionar un commit revisado y reconstruir con `up -d --build`. No borrar el volumen de Firestore para resolver un error de código. La recuperación remota usa el despliegue anterior identificado en Vercel y requiere comprobar de nuevo la API y sus datos.
