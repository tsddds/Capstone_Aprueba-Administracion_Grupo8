# Evidencias del avance de Aprueba Administración

Corte: 20 de octubre de 2026. Estas evidencias respaldan la presentación de evaluación 2. Se obtuvieron del código integrado local, HEAD `aef22bf`, cuyo código funcional corresponde a `db6c916`. No acreditan un nuevo despliegue ni la aceptación final del proyecto.

## Versión vigente reorganizada

Usar `Aprueba_Avance_Evaluacion_2_Reorganizado_2026-10-20.pptx`. La versión anterior quedó abierta en PowerPoint y no se forzó su reemplazo. El nuevo orden tiene quince diapositivas principales y siete anexos ocultos, con objetivo de 12 minutos y 10 segundos antes de ensayo.

- 1–3: presentación, problema, objetivo, alcance y arquitectura.
- 4–7: Docker, herramientas utilizadas, base de datos y almacenamiento, metodología, reparto y sprints.
- 8–13: avances de acceso y usuarios; plataformas y operación; sponsors; preguntas; tickets y recorrecciones; planes e indicadores. Estos grupos relacionan los 27 endpoints, sin declarar E18 ni E26 completamente aceptados.
- 14–15: pruebas, incidencia del primer intento, ajustes y pendientes.
- 16–18: catálogo de los 27 endpoints por integrante, con sus límites.
- 19–22: evidencia de respaldo y fuentes.

Reparto de exposición: Tsung-Hao1–5, Catalina6–10, Felipe11–15. La propiedad del código no cambia por este reparto oral.

## Capturas y comprobaciones ampliadas

`avance_funcional_ampliado.json` conserva el recorrido de interfaz completo y las respuestas relevantes, omitiendo los tokens del inicio de sesión. P01–P05 muestran acceso, resumen, consulta/detalle y modificación del usuario. P06–P09 muestran tickets y recorrecciones; P10–P13, creación/edición/baja de sponsor; P14–P16, listado/importación/edición de preguntas; P17, indicadores; P18, el visor de datos. P19 muestra el ticket ya guardado, P20 la recorrección confirmada y P21 el aviso in-app persistido. El documento del alumno fue contrastado con 250 bronces después de confirmar. Los valores son ficticios locales.

La preparación añadió dos alumnos, dos tickets y dos recorrecciones de demostración, un sponsor y una pregunta importada nueva. El primer conjunto quedó sin uso al ajustar el instrumento de captura y no se borró. El conjunto identificado como demo completó suspensión/reactivación, respuesta al ticket y confirmación con recompensa. El sponsor nuevo se editó y se dio de baja. No se editaron perfiles reales ni datos remotos.

## Regresión completa actualizada

`Regresion_Actualizada/resultados.json` contiene 22 comandos, con 199 ejecuciones de pruebas aprobadas y build del frontend aprobado. Se volvió a ejecutar el mismo código, no se modificó para preparar la presentación. El primer recorrido se detuvo en E14 por una solicitud concurrente de correo que terminó por tiempo de espera. Se conserva ese log y el resultado inicial en `Regresion_Actualizada/Intento_Inicial`. El reintento aislado aprobó 7/7 sin cambiar código, y después se completaron las suites restantes. No se ha demostrado una causa del timeout ni se considera resuelto por el reintento. Las pruebas de concurrencia requieren revisión y la incidencia permanece en la presentación.

La nota interna opcional E18 y la aceptación externa de Stripe test siguen pendientes. Las 199 ejecuciones no significan cobertura total ni aceptación final. Los registros históricos y las 17 repeticiones anteriores permanecen como evidencia previa, sin sumarlos como casos nuevos.

## Primera versión de la exposición de doce diapositivas

La relación siguiente documenta los tres casos de evidencia originales. Sus números de diapositiva corresponden al PPT anterior, no al reorganizado.

1. Tsung-Hao, diapositiva 4: reinicio del laboratorio solicitado desde Operativa, HTTP 202 y comprobación independiente con `docker inspect`.
2. Catalina, diapositiva 8: pregunta creada desde Contenido, HTTP 201 y persistencia del mismo documento como borrador.
3. Felipe, diapositiva 9: plan gratuito creado desde Planes y productos, HTTP 201 y persistencia con precio cero.
4. Felipe, diapositiva 10: captura de un registro TAP real, explicación del método y resultados de las suites repetidas.

Las diapositivas 13 a 18 son apoyo y están ocultas en la presentación normal. Consultarlas si el profesor pide más información. No leer todos los registros en voz alta.

## Caso A de Tsung-Hao

- Ruta: `POST /admin/containers/aprueba-ops-lab/restart`.
- Acción: pulsar Reiniciar en Operativa.
- Esperado: HTTP 202 acepta la solicitud. Después, el contenedor autorizado cambia su fecha de arranque y vuelve a estado saludable.
- Obtenido: HTTP 202; `StartedAt` distinto antes/después; estado `running` y salud `healthy`.
- Evidencia: `A01_operacion_antes.png`, `A02_reinicio_aceptado.png`, `A03_operacion_despues.png` y `A04_operacion_detalle.png`.
- Datos de contraste: caso A de `evidencias_funcionales.json`, con las horas UTC exactas y el identificador de operación. El cambio de hora es la prueba de reinicio; el mensaje de la interfaz por sí solo no lo demuestra.
- Código relacionado: `backend/src/routes/ops.js`, servicios/adaptadores operativos y `compose.ops.yaml` del repositorio de desarrollo. La allowlist se limita a `aprueba-ops-lab`.

## Caso B de Catalina

- Ruta: `POST /admin/questions`.
- Acción: completar una pregunta ficticia de matemática, con cinco alternativas, explicación y habilidad requerida, y pulsar Crear.
- Esperado: HTTP 201 con ID y estado draft. El documento guardado mantiene esos datos.
- Obtenido: HTTP 201 y estado draft. La fila de la interfaz y el documento del emulador tienen el mismo ID. La lectura directa confirma el enunciado y el estado.
- Evidencia: `B01_pregunta_formulario.png`, `B02_pregunta_creada.png`, `B03_firestore_pregunta.png`, `B04_fila_persistida.png` y `B05_firestore_detalle.png`.
- Solicitud, respuesta y documento: caso B de `evidencias_funcionales.json`. No contiene cabeceras de autorización.
- Código relacionado: `backend/src/routes/questions.js`, `backend/src/lib/question-validation.js` y `backend/test/integration/b-questions-create.test.mjs`.
- Alcance: crear un borrador no equivale a publicarlo. Este caso usa explicación de texto; las pruebas automatizadas también comprueban explicación estructurada.

## Caso C de Felipe

- Ruta: `POST /admin/plans`.
- Acción: crear un plan nuevo de demostración con precio cero.
- Esperado: HTTP 201. El documento de plans conserva el mismo ID, nombre y precio.
- Obtenido: HTTP 201; interfaz y Firestore coinciden en ID y nombre; precio guardado 0.
- Evidencia: `C01_plan_formulario.png`, `C02_plan_creado.png`, `C03_firestore_plan.png`, `C04_plan_detalle.png` y `C05_firestore_detalle.png`.
- Solicitud, respuesta y documento: caso C de `evidencias_funcionales.json`.
- Código relacionado: rutas y servicios de planes del backend, `frontend/src/pages/Plans.jsx` y `backend/test/integration/c-catalog.test.mjs`.
- Alcance: un plan gratuito permite demostrar persistencia sin cobros. Este caso no demuestra sincronización real con Stripe.

## Cómo se ejecutaron las pruebas

Las suites arrancan un backend de pruebas, preparan datos ficticios en `demo-aprueba-tests`, realizan solicitudes HTTP y usan aserciones de Node Test Runner. El emulador de tests es independiente del emulador persistente `demo-aprueba-equipo`. El runner limpia únicamente la base de tests y siembra sus fixtures. `backend/dev/run-tests.mjs` contiene estas protecciones y el procedimiento.

Comandos ejecutados desde la raíz `DESARROLLO_FASE2_APRUEBA_ADMIN`:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile test run --rm test node dev/run-tests.mjs b-questions-create
docker compose -f compose.yaml -f compose.ops.yaml --profile test run --rm test node dev/run-tests.mjs c-catalog
```

- `prueba_B_E20.txt`: salida completa de E20, 10 pruebas, 10 aprobadas, 0 fallos. Incluye creación, tipos inválidos, permisos, alternativas y explicación malformada sin guardado parcial.
- `prueba_C_planes.txt`: salida completa del catálogo, 7 pruebas, 7 aprobadas, 0 fallos.
- `pruebas_repetidas.json`: comandos, horas de inicio/fin y códigos de salida de estas ejecuciones.
- `T01_registro_E20.png`: captura del archivo TAP real abierto en el navegador y desplazado a su tramo final. Es una vista del registro, no una terminal reconstruida ni una imagen generada.
- `Regresion_199/`: copia sin cambios de los registros completos, `resultados.json` y `probe.json` de la revisión conjunta anterior del mismo día. Permite comprobar el total de 199 ejecuciones y el diagnóstico adicional de note. Los 17 casos repetidos **no se suman** a ese total ni son 17 casos nuevos.

El resultado esperado de una prueba debe contrastarse con su aserción en el archivo `.test.mjs`. Un registro aprobado no prueba cobertura total ni ausencia de otros defectos.

## Entorno y límites de la captura

- Interfaz: `http://localhost:5173`. API: `http://localhost:4000`. Visor: `http://127.0.0.1:4001/firestore`.
- Chrome con Playwright, viewport de escritorio 1440×1000. El plugin Browser no está disponible en esta sesión. No se instalaron dependencias.
- Flujo probado: entrar con una cuenta ficticia local, ejecutar cada acción, comprobar la respuesta y contrastar persistencia o estado real. Las imágenes de detalle son capturas de filas, columnas o áreas de la interfaz real, sin cambiar su contenido.
- Comprobaciones: título y contenido identifican la aplicación, sin pantalla vacía ni overlay Vite, y sin excepciones `pageerror` en el recorrido completo. Persisten advertencias de React Router y de claves React en Overview/Operations. Se registran en el JSON; no se corrigió código para preparar la exposición. No se hizo QA móvil ni de todos los endpoints.
- Durante la preparación se repitieron capturas. Se añadieron tres preguntas ficticias distinguibles y un plan gratuito, y se realizaron tres reinicios del mismo laboratorio. Dos intentos iniciales del instrumento de captura se detuvieron por una espera de URL incorrecta y una lectura REST sin el acceso especial del emulador; fueron problemas del instrumento, no fallos demostrados del guardado. El recorrido final completó los tres casos. No se borraron datos previos ni volúmenes.
- La lectura directa del emulador se restringió a localhost y al proyecto demo. No se usaron credenciales de Firebase remoto. Los anexos no incluyen contraseñas, JWT ni archivos de servicio.
- La nota interna opcional de E18 continúa rechazada. Falta la aceptación con Stripe real de pruebas. Vercel no se actualizó con esta integración. La revisión humana y aceptación del equipo siguen pendientes.

## Para llevarlo a clase

Conservar la carpeta Anexos junto al PowerPoint. El PPT incorpora las imágenes, por lo que se puede exponer sin abrir esta carpeta ni depender de Internet. Los archivos de texto y JSON permiten responder preguntas técnicas. Si se hará demostración en vivo, ensayar previamente y mantener las capturas como respaldo.
