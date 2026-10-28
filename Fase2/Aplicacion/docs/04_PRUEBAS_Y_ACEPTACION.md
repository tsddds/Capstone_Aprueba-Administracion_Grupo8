# Pruebas y aceptación

## Regresión conjunta del 27 de octubre de 2026

El ejecutor `backend/dev/verify-phase2.mjs` completó 21 suites y la compilación del cliente dentro de Docker. Resultado: 214 aprobadas, cero fallos y cero omitidas. Las suites comparten algunos escenarios; el total no mide cobertura de líneas.

- Autenticación, usuarios y operación: 25 pruebas.
- Patrocinadores, preguntas y recorrecciones: 115.
- Planes y métricas: 22.
- Smoke: 7; contrato: 8.
- Unitarias backend: 20; frontend: 15; configuración Firestore: 2.

[Resumen](evidencias/cierre-2026-10-27/resumen.json), [comandos y resultados](evidencias/cierre-2026-10-27/resultados.json) y [fuentes probadas](evidencias/cierre-2026-10-27/fuente.json).

## Correcciones verificadas

E18 incluye 18 pruebas de resolución: confirmación y rechazo, nota interna, validación, recompensa única, privacidad, concurrencia y rollback. Los cinco casos añadidos reprodujeron el defecto antes de corregirlo. La prueba visual confirmó nota guardada, saldo de 250 bronces y notificación sin nota interna.

E14 incluye nueve pruebas de usuarios y soporte. La reserva de correo normalizado, su liberación y los duplicados heredados aprobaron la suite y tres repeticiones adicionales. La causa exacta del timeout histórico continúa sin confirmar. Las búsquedas heredadas requieren evaluación con mayores volúmenes.

El disparador de métricas tiene pruebas de autorización, método HTTP, configuración inválida y actualización exitosa. Su programación remota sigue pendiente.

## Repetir la verificación

Con Docker iniciado, desde la raíz del repositorio:

```powershell
node backend/dev/verify-phase2.mjs --output .local/verificacion-equipo
```

Elegir una carpeta de salida nueva para conservar ejecuciones anteriores. El runner detiene la secuencia ante un fallo. Para ejecutar una suite sin instalar Node en el computador:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile test run --rm test node dev/run-tests.mjs b-corrections-resolve
```

Los nombres y comandos de todas las suites están en `resultados.json`. Ejecutarlas secuencialmente: comparten el emulador descartable `demo-aprueba-tests`. Los datos de desarrollo se mantienen en `demo-aprueba-equipo`.

## Comprobación del cliente y Docker

El recorrido de navegador cubrió login, resumen, contenido, usuarios y resolución con nota. Se utilizaron escritorio 1440×1000 y una vista móvil 390×844. La comprobación adicional no registró excepciones JavaScript; permanecen avisos de compatibilidad futura de React Router. El primer recorrido registró un recurso404 sin identificar.

Las imágenes se construyeron y los servicios arrancaron con sus comprobaciones de salud. El laboratorio probó medición HTTP, recursos Docker y reinicio real del contenedor permitido. En Windows, si la recarga automática no detecta cambios de backend, reiniciar ese servicio. Los datos persistentes se conservaron.

## Aceptación pendiente

Stripe se probó con proveedor simulado. La aceptación externa requiere comprobar el precio en un sandbox autorizado y su correspondencia con Firestore. También faltan agenda remota de métricas, URLs empresariales, recepción en otros computadores y revisión de pares.

La matriz de casos y defectos registra los resultados técnicos; la planilla grupal registra la revisión del equipo. El [procedimiento de cierre](18_CIERRE_FASE2_Y_ENTREGA.md) contiene los pasos externos y académicos. Los registros históricos se conservan en `evidencias` con su fecha original.
