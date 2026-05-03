# Auditoria tecnica - Shym Gym Tracker

Fecha: 2026-05-03

## Resumen

La app esta bien encaminada: el contrato frontend/backend esta consistente, las pantallas estan registradas, las acciones UI tienen handler y no hay regresion a `google.script.run` ni `HtmlService`.

El mayor riesgo detectado no esta en el cableado general, sino en detalles de datos y comportamiento: carga inicial del Home, fecha local, dependencias de hojas nuevas, drafts al cambiar unidades, notas de sesion y validaciones de peso corporal.

## Checks pasados

- Sintaxis JS de `Code.gs`: ok.
- Sintaxis del script en `index.html`: ok.
- Todas las llamadas `gas.*` del frontend existen en `getApi_()`.
- Todas las acciones `data-action` estaticas tienen handler.
- Todas las screens HTML estan registradas.
- No hay IDs estaticos duplicados ni referencias faltantes.
- No aparece `google.script.run`.
- No aparece `HtmlService`.

## Hallazgos priorizados

### Alto

1. El Home no carga stats al abrir la app si ya hay backend configurado.
   - Causa: el boot solo hace `gas.ping()`; no llama `goTo('home')` ni `loadHomeStats()`.
   - Impacto: el Home puede quedar con `0` y `—` hasta navegar y volver.

2. La fecha "hoy" del frontend usa UTC.
   - Causa: `todayInputValue()` usa `new Date().toISOString().slice(0, 10)`.
   - Impacto: en Argentina, despues de las 21:00 puede usar la fecha de manana.

3. Progreso por ejercicio puede fallar si existe codigo nuevo pero no se corrio `setup()`.
   - Causa: `listExerciseHistory()` llama a `getExerciseGoal()`, que lee `Exercise_Goals`.
   - Impacto: si la hoja de goals no existe todavia, rompe una vista que deberia funcionar igual sin metas.

4. Los drafts interpretan mal pesos si se cambia kg/lb.
   - Causa: el draft guarda el valor crudo del input sin unidad ni valor canonico en kg.
   - Impacto: un `70` escrito en kg puede restaurarse como `70 lb` y guardarse mal.

### Medio

5. Las notas de entrenamiento se guardan por set, pero el detalle no las muestra y la edicion las borra.
   - Impacto: el usuario cree haber guardado sensaciones/tecnica, pero no las ve y puede perderlas al editar.

6. Peso corporal acepta valores invalidos.
   - Causa: inputs sin `min` y backend solo parsea numero.
   - Impacto: se puede guardar `0` o negativo y contaminar progreso corporal.

7. Borrar rutinas/dias conserva sesiones, pero puede perder contexto historico.
   - Causa: sesiones guardan IDs; si se borran rutinas/dias/ejercicios, algunas vistas pierden nombres o metadata.
   - Impacto: historial menos legible y heatmap incompleto para ejercicios borrados.

8. Duplicar una rutina vieja puede copiar ejercicios sin musculo.
   - Causa: `duplicateRoutine()` copia `muscle_group` tal cual, aunque ahora sea obligatorio en alta/edicion.
   - Impacto: heatmap y graficos por musculo pueden quedar incompletos en rutinas duplicadas desde datos viejos.

### Bajo

9. Historial puede filtrar parcialmente si hay mas de 60 sesiones recientes.
   - Causa: calendario cubre 91 dias, pero lista base trae 60 sesiones.
   - Impacto: un dia con varias sesiones fuera de esas 60 puede no mostrarse completo.

10. Abrir sesion desde Progreso vuelve al Home.
    - Causa: `openSessionDetail()` solo recuerda retorno especial para Historial.
    - Impacto: pequena friccion UX.

## Arreglos iniciados

Los arreglos se estan aplicando empezando por los puntos de mayor impacto directo en funcionamiento y datos.

## Arreglos aplicados

- Boot con backend configurado ahora entra por `goTo('home')` para disparar carga real del Home.
- `todayInputValue()` usa fecha local del navegador en vez de UTC.
- Goals ya no rompen Progreso si falta la hoja `Exercise_Goals`; `setExerciseGoal()` la crea si hace falta.
- Drafts de entrenamiento guardan valores canonicos en kg y restauran segun la unidad actual.
- Peso corporal valida `> 0` en backend y los inputs tienen `min="1"`.
- Detalle de sesion muestra nota guardada por ejercicio y edicion preserva notas existentes.
- Abrir una sesion desde Progreso ahora vuelve a Progreso al cerrar el detalle.
- Sesiones nuevas guardan snapshot de `routine_name` y `day_name`, para que el historial siga legible si se borra una rutina o dia.
- Sets nuevos guardan snapshot de `muscle_group`; heatmap, volumen por musculo e historial muscular lo priorizan antes de mirar la rutina actual.
- Duplicar rutina infiere grupos musculares por ejercicios iguales y bloquea la copia si hay ejercicios viejos sin grupo imposible de inferir.
- Historial ahora pide sesiones de los ultimos 91 dias hasta un maximo de 500, alineado con el calendario.
- `setup()` ejecuta migracion historica de snapshots y queda disponible `migrateHistoricalSnapshots()` para correrla manualmente.

## Limitaciones restantes

- La migracion no puede recuperar datos que ya no sean inferibles: por ejemplo, una sesion vieja cuyo dia/rutina fue borrado antes de migrar, o un ejercicio viejo sin grupo muscular y sin ningun ejercicio actual con nombre equivalente.
