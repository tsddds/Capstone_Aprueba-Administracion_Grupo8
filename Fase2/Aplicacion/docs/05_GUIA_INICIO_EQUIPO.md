# Inicio del proyecto en otro computador

## Preparación

Instalar Git, Visual Studio Code y Docker Desktop con virtualización habilitada. La copia académica pública puede descargarse sin credenciales del entorno remoto. El entorno local instala las dependencias dentro de sus imágenes Docker.

Guardar los cambios propios antes de actualizar o cambiar de rama. Esta copia contiene el corte de Fase 2 publicado en el repositorio académico. Para desarrollar, el equipo debe acordar si utiliza esta copia o las ramas del repositorio de trabajo; no intercambiar cambios entre ambos sin revisión.

```powershell
git clone https://github.com/tsddds/Capstone_Aprueba-Administracion_Grupo8.git
cd Capstone_Aprueba-Administracion_Grupo8
git switch -c codex/nombre-tarea
cd Fase2/Aplicacion
```

Para una copia existente, usar `git fetch origin` y revisar la rama acordada. Evitar sobrescribir cambios de los compañeros.

## Arranque

```powershell
docker compose -f compose.yaml -f compose.ops.yaml --profile ui up -d --build
docker compose -f compose.yaml -f compose.ops.yaml ps
```

Aplicación: http://localhost:5173. API: http://localhost:4000/health. Visor: http://localhost:4001/firestore. El login muestra las cuentas ficticias del emulador. La semilla crea documentos ausentes y conserva los existentes.

El backend y frontend montan el código local para trabajar desde VS Code. Si un cambio de backend no aparece, ejecutar:

```powershell
docker compose -f compose.yaml -f compose.ops.yaml restart backend
```

Los cambios de dependencias o Dockerfile requieren reconstruir la imagen. Las credenciales productivas de Firebase y Vercel no son necesarias para este entorno.

## Recepción y trabajo diario

Comprobar login, lectura de usuarios, una escritura ficticia y su persistencia en el visor. Ejecutar la suite del módulo y la regresión acordada antes de solicitar revisión. Registrar computador, fecha, comandos y resultados de recepción.

Trabajar en una rama propia, crear commits con cambios relacionados y solicitar revisión mediante PR a la rama que acuerde el equipo. El reparto de módulos está en [responsabilidades](01_REPARTO_EQUIPO.md). Los criterios y suites están en [pruebas](04_PRUEBAS_Y_ACEPTACION.md).

## Detener el entorno

```powershell
docker compose -f compose.yaml -f compose.ops.yaml stop
```

El volumen conserva los datos de desarrollo. `down -v` elimina ese volumen y sus cambios, por lo que no forma parte del procedimiento diario. El puente operativo tiene acceso privilegiado al daemon y se usa exclusivamente para el laboratorio local autorizado.
