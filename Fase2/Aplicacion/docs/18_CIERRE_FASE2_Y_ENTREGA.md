# Cierre técnico y entrega de Fase 2

Estado documental al 4 de noviembre de 2026. El informe final sigue la guía académica 2.6. La evidencia técnica corresponde al 27 de octubre de 2026.

## 1. Resultado disponible

- Código A/B/C integrado sobre `a2b05bea`, con cambios locales de cierre.
- Docker Compose construido y ejecutado con frontend, backend, Firestore local y laboratorio operativo dedicado. Los datos persistidos de desarrollo se conservaron.
- Regresión completa: **214 pruebas aprobadas, 0 fallidas, 0 omitidas**, en 21 suites, más una compilación frontend. Hay escenarios solapados; no es cobertura de líneas ni 214 funciones distintas.
- E18 admite la nota interna opcional, valida tipo y longitud máxima de 2000 caracteres y la guarda en la transacción. No la envía al alumno. Suite de resolución: 18/18.
- E14 reserva el correo normalizado mediante `adminEmailClaims`, conserva los ID existentes y comprueba registros heredados. Suite A Sprint 2: 9/9; tres repeticiones adicionales 9/9 cada una. No se demostró una reducción de tiempo ni la causa exacta del timeout histórico. La búsqueda heredada continúa siendo lineal.
- Disparador operativo `GET /internal/metrics/refresh` protegido con `CRON_SECRET`. Pruebas HTTP y unitarias incluidas. No forma parte de los 27 endpoints administrativos ni está programado en Vercel todavía.
- Cliente: formulario de nota interna, clave React de servicios y texto correcto sobre preguntas importadas en borrador.
- Seguimiento grupal de los 27 endpoints y cinco matrices complementarias. El informe final incorpora tres capturas. La revisión de pares y los acuerdos del equipo se registran en las planillas correspondientes.

Evidencia: [resumen](evidencias/cierre-2026-10-27/resumen.json), [comandos y resultados](evidencias/cierre-2026-10-27/resultados.json), [fuente verificada](evidencias/cierre-2026-10-27/fuente.json), [recorrido del cliente](evidencias/cierre-2026-10-27/navegador.json) y [comprobación de persistencia](evidencias/cierre-2026-10-27/persistencia-ui.json).

## 2. Abrir y repetir la demostración

Abrir Docker Desktop. En PowerShell, dentro de `DESARROLLO_FASE2_APRUEBA_ADMIN`:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile ui up -d --build
docker compose -f compose.yaml -f compose.ops.yaml ps
```

Aplicación: http://localhost:5173. API: http://localhost:4000/health. Visor: http://localhost:4001/firestore. Las cuentas de prueba se muestran en el login y son exclusivas del emulador. No usar sus credenciales en Vercel ni en Firebase remoto.

Si un cambio de backend no aparece en Windows, ejecutar `docker compose -f compose.yaml -f compose.ops.yaml restart backend`. Durante esta revisión el watcher no cargó todos los cambios; el reinicio permitió verificar la versión actual. No se solucionó eliminando datos.

Recorrido sugerido: iniciar sesión; mostrar resumen; abrir Contenido y distinguir borradores/publicadas; en Usuarios y soporte mostrar usuarios y una solicitud pendiente; resolver una solicitud ficticia; abrir Firestore y comparar `corrections/{id}`, `users/{id}/notifications/{id}` y `medalMovements/{id}`. La nota es interna y el aviso del alumno no debe contenerla. No volver a resolver una solicitud ya confirmada para intentar otra recompensa.

La solicitud `cierre_20261027` quedó confirmada como evidencia local. Se crearon tres documentos ficticios propios (usuario, pregunta y solicitud) y los efectos de resolución. No se modificaron alumnos reales ni se restableció el volumen.

Para repetir toda la regresión, usar Node y un directorio de salida nuevo:

```powershell
node backend/dev/verify-phase2.mjs --output .local/verificacion-equipo
```

El runner exige no sobrescribir evidencias y detiene la ejecución ante el primer fallo. No ejecutar suites de integración en paralelo contra `demo-aprueba-tests`. Las pruebas se restablecen en ese proyecto descartable, separado de `demo-aprueba-equipo`.

## 3. Pruebas de sincronización de precios

La entrega académica usa el proveedor simulado. La suite `c-billing` comprueba cambios de precio, fallos y reintentos. Los registros están en [la evidencia del 27 de octubre](evidencias/cierre-2026-10-27/c-billing.txt).

## 4. Programar métricas en el entorno remoto

Este paso requiere acceso al proyecto Vercel y autorización para desplegar. No se ejecutó en esta revisión.

1. Confirmar el plan Vercel. [Hobby permite cron diario; Pro admite mayor frecuencia](https://vercel.com/docs/cron-jobs/usage-and-pricing). Una expresión cada cinco minutos no es compatible con Hobby. No cambiar el contrato a Cloud Run por esta limitación.
2. Crear `CRON_SECRET` privado, aleatorio, de al menos 32 caracteres y distinto de `JWT_SECRET`, en las variables **del proyecto backend**. No colocarlo en el frontend. Vercel envía `Authorization: Bearer <CRON_SECRET>` a sus invocaciones cron.
3. Si se acuerda ejecución diaria en Hobby, agregar al `backend/vercel.json` existente, conservando sus otras propiedades:

```json
"crons": [{ "path": "/internal/metrics/refresh", "schedule": "0 12 * * *" }]
```

La hora de cron es UTC y Hobby no asegura el minuto exacto. Si se requiere el intervalo de 300 segundos del parámetro local, usar un plan o programador externo autorizado que lo soporte y envíe el secreto. Acordar la agenda antes de dar por aceptada la periodicidad. En ejecución persistente local, `appConfig/metrics.metricsRefreshSeconds` controla el temporizador; el cron remoto es configuración de infraestructura que debe mantenerse coherente con ese parámetro.
4. Desplegar el backend autorizado y comprobar `/health`, luego invocar el trigger con el secreto desde una herramienta que no guarde la cabecera en la evidencia. Sin configuración devuelve 503; con secreto incorrecto, 401; un JWT de administrador no reemplaza el secreto; otros métodos devuelven 405. Con autorización correcta debe devolver 200 y metadatos de actualización.
5. Verificar dos ejecuciones reales y comparar `generatedAt` de `metrics/overview-30d` y `commercial-30d`, incluyendo una ejecución sin abrir el panel. Abrir la página únicamente demuestra refresco bajo demanda, no periodicidad de fondo.
6. Registrar fecha, agenda, logs y persistencia remota sin credenciales. Si cambió la frecuencia acordada, actualizar appConfig y la documentación del entorno. Las URLs de servicios empresariales requieren autorización y configuración propias; la sonda local no los representa.

Fuentes: [configuración de cron](https://vercel.com/docs/cron-jobs), [protección y gestión](https://vercel.com/docs/cron-jobs/manage-cron-jobs). No añadir el socket Docker local ni el puente privilegiado al despliegue Vercel.

## 5. Revisión del equipo y contenido académico

1. Cada compañero recibe el código integrado **después de publicar la rama**, conserva sus cambios y lo ejecuta en su computador. Registrar sistema, fecha, comando, resultado y cualquier diferencia. Una ejecución en este PC no prueba los tres equipos.
2. Catalina revisa E18, permisos, importación y comportamiento de sponsors/preguntas; Felipe revisa planes, métricas, integración y la reserva de correo con Tsung-Hao. Marcar los campos amarillos de revisión solo después de realizarla.
3. Reunir una revisión real del incremento: qué se acepta, qué queda pendiente, responsables y fecha acordada. Registrar la retrospectiva o acuerdos que efectivamente se hagan. No completar minutas retroactivas como si hubieran ocurrido.
4. Abrir el informe `docs/informe-final/2.6_Informe_Final_Proyecto_APT_Aprueba_Administracion.docx`. Revisar nombres, competencias oficiales y la sección 6. Cada integrante escribe su reflexión final con un aprendizaje, dificultad, evidencia de aporte y proyección. Los antecedentes de Fase 1 sirven de base; no equivalen a una reflexión final confirmada.
5. Actualizar resultados externos y pendientes del informe después de ejecutarlos. Los seis Excel son el seguimiento operativo; la rúbrica académica la completa el docente.
6. Conservar el PPT elegido como apoyo para la presentación. Tiene su fecha y no reemplaza este informe. Si se usan cifras actuales en la defensa, citar las 214 pruebas del nuevo corte y explicar los pendientes.

## 6. Publicación y entrega

No se hicieron commit, push, merge ni cambios remotos el 27/10. Para publicar, primero revisar todo el diff y los archivos nuevos, especialmente que no se incluyan `.env`, claves, exportaciones de bases reales ni la carpeta privada `.local`.

```powershell
git status --short
git diff --stat
git diff --check
```

Guardar los cambios ajenos que pudieran haber llegado al equipo. Usar una rama de revisión con prefijo `codex/`, por ejemplo `codex/cierre-fase2`, creada desde la integración local actual. Incluir únicamente código, tests, guías, informe, seguimiento y evidencia del cierre. Revisar los archivos a preparar y luego crear commit y push a esa rama; solicitar revisión mediante PR. No hacer push directo a main ni sobrescribir ramas de compañeros. La existencia de un PR no equivale a que se haya aprobado o desplegado.

Paquete académico: informe final revisado; seis Excel; capturas y registros de pruebas del corte; código fuente con Docker y README; referencias de requisitos/arquitectura y enlaces Git/URL que el docente solicite. No incluir `node_modules`, volúmenes Docker, secretos, `.git` completo, temporales de autoría ni históricos ajenos a la entrega.

La carga en la plataforma académica y la confirmación de recepción las realiza un integrante con su cuenta. Guardar comprobante de fecha/archivo y registrar la entrega real en el control, sin marcarla completada antes de subirla.
