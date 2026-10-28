# Cierre técnico y entrega de Fase 2

Corte: 27 de octubre de 2026. Entrega solicitada: informe final de Fase 2, según guía académica 2.6. El candidato local está preparado y probado; faltan las acciones externas y personales que se detallan aquí. No se publicó un nuevo commit ni se desplegó esta revisión.

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

## 3. Crear acceso de pruebas de Stripe

1. Entrar al [registro oficial de Stripe](https://dashboard.stripe.com/register), crear la cuenta con datos propios correctos y verificar el correo. Si la empresa proporciona acceso, aceptar una invitación al sandbox en lugar de compartir contraseñas.
2. Seleccionar un **sandbox o entorno de pruebas** en el selector del Dashboard. No es necesario activar cobros reales para empezar a probar. No ingresar tarjetas reales para esta comprobación: este proyecto valida sincronización de catálogo, no cobros.
3. El registro requiere datos correctos del titular y su entidad. Si la cuenta no permite acceder a un sandbox, solicitar uno autorizado a la empresa o al docente. Chile no figura en la lista comercial de países soportados consultada. Max también autorizó Flow de pruebas; esa alternativa requiere implementar y validar su adaptador.
4. En las claves API del sandbox, obtener la **clave privada de pruebas**. El adaptador actual exige prefijo `sk_test_`; `pk_test_` no sirve y `rk_test_` no está admitida por esta implementación. No guardar la clave en el frontend, Git, capturas, Excel o chat.
5. La cuenta queda a cargo de su titular. Compartir con compañeros mediante invitaciones y permisos, nunca entregando la contraseña de la cuenta personal.

Fuentes: [cuentas y sandbox](https://docs.stripe.com/get-started/account), [claves](https://docs.stripe.com/keys), [entornos de pruebas](https://docs.stripe.com/testing), [disponibilidad comercial](https://stripe.com/global). Consulta 27/10/2026.

## 4. Conectar la clave solo al backend local

Crear `.local/compose.stripe-test.yaml` dentro del repositorio. `.local/` ya está ignorada por Git. Contenido **sin la clave**:

```yaml
services:
  backend:
    environment:
      STRIPE_TEST_SECRET_KEY: ${STRIPE_TEST_SECRET_KEY:?Falta clave privada de pruebas}
```

En PowerShell, leerla sin escribirla como texto literal en el historial:

```powershell
$stripeSecretInput = Read-Host 'Clave privada del sandbox Stripe' -AsSecureString
$stripeSecretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($stripeSecretInput)
try {
  $env:STRIPE_TEST_SECRET_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($stripeSecretPtr)
  if ($env:STRIPE_TEST_SECRET_KEY -notmatch '^sk_test_[A-Za-z0-9_]+$') {
    throw 'Se requiere una clave privada de pruebas sk_test_'
  }
  docker compose -f compose.yaml -f compose.ops.yaml -f .local/compose.stripe-test.yaml up -d --no-deps --force-recreate backend
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo recrear el backend' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($stripeSecretPtr)
  Remove-Item Env:STRIPE_TEST_SECRET_KEY -ErrorAction SilentlyContinue
  $stripeSecretInput = $null
}
```

La clave permanece en el contenedor local hasta recrearlo sin el override. No ejecutar ni compartir `docker compose config` o `docker inspect` con esa configuración porque pueden mostrarla. La semilla y los tests siguen sin recibirla. No crear `backend/.env`: el arranque aislado lo rechaza por diseño.

## 5. Aceptar la sincronización de precios

Realizar esta comprobación con Felipe, responsable del módulo de planes:

1. Iniciar sesión en la aplicación local como administrador. Crear un plan de prueba nuevo, sin suscriptores, con precio 1000 CLP y nombre identificable. No reutilizar un plan con una operación pendiente antigua.
2. Guardar su ID y observar el documento en el visor Firestore. Crear el plan no demuestra todavía una sincronización de precio.
3. Editar únicamente el precio a 1250 CLP y guardar. El cliente envía `PUT /api/v1/admin/plans/{id}`. Debe devolver 200; el precio local solo debe cambiar tras confirmar Stripe.
4. En el sandbox Stripe, abrir el producto correspondiente y verificar un precio mensual CLP de 1250. El adaptador crea un nuevo Price, no cambia retroactivamente el importe de un Price existente ni migra suscripciones.
5. En Firestore revisar `plans/{id}.billing`: `mode=test`, `productId` y `priceId`. Revisar `planPriceOperations/{id}` con `status=completed` y el registro `adminAudit` de `update-price`.
6. Repetir la misma solicitud sin cambiar los datos. Debe conservar precio e identificadores y no crear otra operación de precio innecesaria. Si hay 503, no borrar `planPriceOperations`: corregir configuración/conectividad y reintentar el mismo cambio. Si la operación supera la ventana de conciliación (23 horas en esta implementación), revisar Stripe antes de reintentar; no forzar el estado a mano.
7. Guardar fecha, ID ficticio, estado HTTP y capturas del producto/Price y Firestore sin claves ni cabeceras Authorization. Registrar el resultado en la misma planilla 06, caso API-026, y actualizar el estado de Stripe en 02/04/05 y el informe. Hasta entonces sigue pendiente, aunque los mocks pasen.
8. Al terminar, recrear el backend sin el override para retirar la clave del contenedor:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml up -d --no-deps --force-recreate backend
```

No se requiere instalar Stripe CLI, un plugin ni SDK nuevo para este recorrido. [Referencia de creación de precios](https://docs.stripe.com/api/prices/create).

## 6. Programar métricas en el entorno remoto

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

## 7. Revisión del equipo y contenido académico

1. Cada compañero recibe el código integrado **después de publicar la rama**, conserva sus cambios y lo ejecuta en su computador. Registrar sistema, fecha, comando, resultado y cualquier diferencia. Una ejecución en este PC no prueba los tres equipos.
2. Catalina revisa E18, permisos, importación y comportamiento de sponsors/preguntas; Felipe revisa planes, métricas, integración y la reserva de correo con Tsung-Hao. Marcar los campos amarillos de revisión solo después de realizarla.
3. Reunir una revisión real del incremento: qué se acepta, qué queda pendiente, responsables y fecha acordada. Registrar la retrospectiva o acuerdos que efectivamente se hagan. No completar minutas retroactivas como si hubieran ocurrido.
4. Abrir el informe `docs/informe-final/2.6_Informe_Final_Proyecto_APT_Aprueba_Administracion.docx`. Revisar nombres, competencias oficiales y la sección 6. Cada integrante escribe su reflexión final con un aprendizaje, dificultad, evidencia de aporte y proyección. Los antecedentes de Fase 1 sirven de base; no equivalen a una reflexión final confirmada.
5. Actualizar resultados externos y pendientes del informe después de ejecutarlos. Los seis Excel son el seguimiento operativo; la rúbrica académica la completa el docente.
6. Conservar el PPT y guion elegidos como apoyo para la presentación. Tienen su fecha y no reemplazan este informe. Si se usan cifras actuales en la defensa, citar las 214 pruebas del nuevo corte y explicar los pendientes.

## 8. Publicación y entrega

No se hicieron commit, push, merge ni cambios remotos el 27/10. Para publicar, primero revisar todo el diff y los archivos nuevos, especialmente que no se incluyan `.env`, claves, exportaciones de bases reales ni la carpeta privada `.local`.

```powershell
git status --short
git diff --stat
git diff --check
```

Guardar los cambios ajenos que pudieran haber llegado al equipo. Usar una rama de revisión con prefijo `codex/`, por ejemplo `codex/cierre-fase2`, creada desde la integración local actual. Incluir únicamente código, tests, guías, informe, seguimiento y evidencia del cierre. Revisar los archivos a preparar y luego crear commit y push a esa rama; solicitar revisión mediante PR. No hacer push directo a main ni sobrescribir ramas de compañeros. La existencia de un PR no equivale a que se haya aprobado o desplegado.

Paquete académico: informe final revisado; seis Excel; capturas y registros de pruebas del corte; código fuente con Docker y README; referencias de requisitos/arquitectura y enlaces Git/URL que el docente solicite. No incluir `node_modules`, volúmenes Docker, secretos, `.git` completo, temporales de autoría ni históricos ajenos a la entrega.

La carga en la plataforma académica y la confirmación de recepción las realiza un integrante con su cuenta. Guardar comprobante de fecha/archivo y registrar la entrega real en el control, sin marcarla completada antes de subirla.
