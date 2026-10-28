# Comprobaciones adicionales — 29/09/2026

Fuente de resultados automatizados: `resultados.json`, actualizado por ejecución real de `backend/dev/verify-a.mjs`. Horas UTC del 30/09 corresponden a la noche local del 29/09. Los logs incluyen avisos de Compose por servicios del overlay ausentes del archivo base: no eliminarlos con `--remove-orphans`.

## Arranque y lectura local

Ejecutado `docker compose -f compose.yaml -f compose.ops.yaml --profile ui up --build -d`: exit0. Backend, Firestore y laboratorio saludables; frontend/bridge en ejecución. Seed: **0 creados, 45 existentes**, proyecto `demo-aprueba-equipo`; no se reinicializó el volumen persistente.

Comprobación HTTP mediante PowerShell usando login demo y proxy Vite en localhost5173: login correcto; GET users, users/usr_demo_01, tickets, platforms, services y containers devuelven200. GET visor localhost4001/firestore200; health localhost4000 responde ok. No se imprimieron tokens ni se usaron servicios remotos. No equivale a un recorrido visual completo de todas las pantallas.

## Regresión de concurrencia

`a-sprint2-antes-correccion-bloqueos.txt` conserva un fallo intermitente real detectado durante repetición: correo concurrente obtuvo200/500. Se corrigió el orden de adquisición del bloqueo común antes de leer el usuario. La prueba vigente repite cinco carreras con direcciones distintas, comprueba200/409 y solo un usuario con el correo objetivo. No se eliminó ni debilitó la aserción para conseguir verde.

## Alcance de las evidencias

- Una sonda HTTP y un contenedor real dedicado: no evidencia de disponibilidad de todos los servicios de negocio.
- No prueba de carga sostenida, pentest, cobertura de líneas, evaluación de dependencias, despliegue cloud ni aceptación académica.
- La suite contractual general conserva siete defectos B/C. El script permite terminar el registro aun cuando esa suite falle, pero registra exitCode1 y cada fallo; no oculta el estado rojo.
- Las revisiones de pares, defensa y notas permanecen pendientes hasta efectuarse realmente.
