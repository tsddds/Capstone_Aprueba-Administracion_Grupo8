# Ver los datos mientras pruebas el backend

## Objetivo

Ejecutar una acción desde Aprueba local o una solicitud API y comprobar qué documento cambió en Firestore Emulator. No tocar la aplicación Vercel ni la base Firebase remota. Usamos la interfaz oficial Firebase Emulator Suite, no un panel nuevo desarrollado por el equipo.

## Arranque con Docker

Desde la raíz de esta copia, con Docker instalado y ejecutándose:

```sh
docker compose config --quiet
docker compose --profile ui up --build -d
docker compose ps -a
docker compose logs --tail=60 firestore seed backend
```

`--build` reconstruye las imágenes con los archivos y la configuración actuales. El entorno Docker, el visor, la API y el emulador se verificaron el 27/10/2026. La recepción en los computadores de los compañeros continúa pendiente.

- Aprueba local: http://localhost:5173 . Permite iniciar sesión y usar pantallas existentes.
- Visor de datos: http://127.0.0.1:4001/firestore . Abrir Firestore → Data; proyecto demo-aprueba-equipo, base default.
- API local: http://localhost:4000/api/v1/admin . No es una página de gestión de datos; las herramientas/pruebas le envían solicitudes.

El perfil llamado ui de Compose inicia el frontend de Aprueba. El visor de Firestore arranca con el servicio firestore aunque no se active ese perfil. La base separada demo-aprueba-tests no tiene interfaz ni puertos publicados; sus tests pueden vaciar sus datos y por eso no se usa para edición diaria.

Si no abre, comprobar motor y logs; no cambiar a la consola cloud ni quitar las guardias. Puertos del visor y sus servicios auxiliares se publican solo en 127.0.0.1. No usar reenvío público, ni montar credenciales reales, ni compartir el visor por Internet.

## Cómo leer la pantalla

Izquierda: colecciones como plans, users o sponsors. Centro: documentos con su ID. Derecha: campos y valores del documento seleccionado. Los mapas y listas se pueden desplegar. El lápiz permite editar un campo manualmente; es útil para preparar un escenario, pero no demuestra que el endpoint funcione.

No pulsar Clear all data: borra los datos del emulador. Para reiniciar o detener sin borrar el volumen, usar las instrucciones del README. La persistencia depende de la exportación al detener normalmente; no es un respaldo productivo.

## Primera prueba: cambiar un precio

1. En el visor abre plans → pl_demo_empty. Su nombre es «Plan sin suscriptores ficticio»; precio inicial 1000.
2. En Aprueba local inicia sesión con admin@example.test y la contraseña pública exclusiva del emulador que aparece en el README. Deja MFA vacío.
3. Abre Planes y productos. Edita ese plan, cambia el precio a 1250 y guarda. Es importante guardar: cambiar solo un campo del formulario puede modificar únicamente memoria del navegador.
4. Regresa al documento abierto en el visor. Revisa price: debe reflejar 1250 después de una escritura exitosa; si no se actualiza, vuelve a abrir el documento o recarga.
5. Consulta de nuevo el plan desde Aprueba/API para comprobar que no era solo un cambio visual. Al terminar puedes restaurar el precio original.

Comprobación efectuada en esta tarea: login HTTP 200 → PUT de precio 1000 a 1250 HTTP 200 → visor mostrando 1250 → GET mostrando 1250 → precio restaurado. Se probó mediante API y navegación por el visor; no se afirma haber probado los botones del frontend Aprueba en esta sesión. No acredita sincronización Stripe, todavía pendiente.

### Alternativa directa mediante API (PowerShell)

Estas órdenes solo apuntan a localhost y usan cuenta DEMO; requieren el entorno anterior iniciado. No sustituir el dominio por Vercel.

```powershell
$datosLogin = @{email='admin@example.test';password='SoloEmulador_2026_Prueba!'} | ConvertTo-Json
$sesionLocal = Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/v1/admin/auth/login' -ContentType 'application/json' -Body $datosLogin
$cabecerasLocal = @{Authorization="Bearer $($sesionLocal.data.accessToken)"}
Invoke-RestMethod -Method Put -Uri 'http://localhost:4000/api/v1/admin/plans/pl_demo_empty' -Headers $cabecerasLocal -ContentType 'application/json' -Body '{"price":1250}'
Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/admin/plans' -Headers $cabecerasLocal
```

El token no se imprime en estas instrucciones; no copiar su valor a GitHub/chat. Después observar price en el visor. Para restaurarlo, repetir PUT con precio 1000.

## Otros ejemplos

- Stock: sponsors → spo_demo_01 → benefits → primer elemento → stock (inicial 10). Si una acción del backend actualiza ese beneficio, revisar su nuevo stock ahí. El visor no implementa la lógica de canje ni garantiza que todos los botones heredados funcionen.
- Usuarios: users → usr_demo_01 → state/email/plan. Observar la acción administrativa correspondiente.
- Preguntas: questions → qst_demo_01 → statement/status/correctAnswer. Observar cambios de edición/publicación de preguntas; no se agrega una función «publicar proyectos» que no está en el alcance.
- Login: adminUsers contiene la cuenta administrativa. El código actual lee la cuenta y devuelve tokens; no escribe automáticamente lastLogin, una sesión ni un historial en Firestore. Por tanto un login correcto NO tiene que cambiar un documento. Se comprueba HTTP 200 y sesión en Aprueba; contraseña incorrecta debe dar 401. La pestaña Authentication del visor no sustituye adminUsers: este login no usa Firebase Authentication.

## Datos existentes y campo color

La prueba detectó que los planes de los fixtures iniciales no tenían color. La ruta heredada PUT trataba de guardar undefined y devolvía 500 al enviar solo price. Se añadió color a los cuatro planes del generador y una comprobación unitaria, sin alterar lógica de endpoints.

Un seed repetido NO actualiza documentos existentes. Si ya habías cargado la versión anterior en TU emulador, abre cada plan sin color y agrega el campo color, tipo string, valor de ejemplo #6366F1. No borres toda la base ni modifiques Firebase remoto para resolverlo. Otra opción es incluir color válido en la actualización de ese plan. Sigue pendiente que el responsable del endpoint maneje de forma robusta datos incompletos, no solo fixtures completos.

## Qué significa cada cambio

Cambiar desde la aplicación/API prueba lógica y persistencia. Cambiar directamente en el visor prepara datos pero evita la lógica del backend. Si el dato debe llegar también a los compañeros, actualizar fixtures y revisar/versionar el cambio; una edición manual no se sincroniza por Git.

Los snapshots metrics no se recalculan todavía automáticamente al cambiar precios/stock. Un documento actualizado no prueba que todo indicador del Resumen deba cambiar hasta implementar sus cálculos. Datos ficticios de servicios/contenedores tampoco demuestran operación real.

## Verificación de la interfaz y límites

Verificado 2026-09-23 con Chrome headless/Playwright, escritorio 1440×1000, Node 24/Java 17/Firebase CLI 14.12.0 y UI 1.15.0. Browser plugin específico ausente; fallback Playwright disponible sin instalar dependencias de navegador. Página identificada como Firebase Emulator Suite, no vacía ni overlay de error. Se seleccionaron plans y pl_demo_empty y se observó el precio actualizado sin recargar.

Sin excepciones pageerror. La consola del visor oficial registra avisos app/app-deleted al cambiar de colección: permanecen, no se parcheó código de Firebase. No impidieron lectura/actualización comprobadas; no declarar consola totalmente limpia. La prueba final cargó fuentes oficiales Google Fonts; ningún registro o secreto se envió a servicios de datos remotos.

Evidencia visual JPG y resultado técnico locales fuera del repositorio publicable. Docker, Requests/websocket dentro de Docker, edición manual mediante lápiz, móvil y flujo de botones del frontend Aprueba todavía no verificados en esta tarea. Para desarrollo se priorizó inspección de datos después de una operación API real.

Referencia: https://firebase.google.com/docs/emulator-suite/connect_and_prototype?database=Firestore
