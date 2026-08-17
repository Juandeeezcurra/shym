# Shym Project Memory

Esta es la biblia corta del proyecto. Si algo contradice esto, confiar primero en este archivo y despues verificar el codigo.

## Arquitectura Canonica

- La app es **frontend estatico en GitHub Pages + backend API en Google Apps Script**.
- El usuario abre la app en: `https://juandeeezcurra.github.io/shym/`.
- El frontend canonical es `index.html` en la raiz del repo. Debe estar en lowercase para GitHub Pages.
- No usar `Index.html` como archivo canonical. No volver a depender de Apps Script HtmlService.
- Apps Script contiene **solo `Code.gs`**.
- `Code.gs` expone API JSON por `doPost(e)`.
- El frontend llama al backend con `fetch` a la URL del Web App que termina en `/exec`.
- La URL del backend se guarda en `localStorage` con key `gymtracker:backend-url`.
- `google.script.run` esta prohibido en este proyecto. Si aparece, es una regresion.
- `HtmlService.createTemplateFromFile('Index')` esta prohibido en este proyecto. Si aparece, es una regresion.

## Deploy Correcto

### Frontend

- Cambios en `index.html` se pushean a GitHub.
- GitHub Pages sirve el HTML automaticamente.
- Si el navegador no ve cambios: hard refresh. En iPhone puede requerir limpiar cache de Safari.

### Backend

Cada vez que cambia `Code.gs`:

1. Copiar `Code.gs` desde GitHub raw.
2. Pegar en Apps Script, reemplazando todo el contenido.
3. Guardar.
4. Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy.
5. Configuracion del Web App:
   - Execute as: `Me`
   - Access: `Anyone`
6. Copiar la URL que termina en `/exec`.
7. En la app de GitHub Pages, pegar esa URL en la pantalla "Configurar backend".

No pegar `index.html` en Apps Script. Eso fue el error que mezclo arquitecturas.

## Contrato API

El frontend manda:

```js
fetch(BACKEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ fn: 'nombreFuncion', args: [...] })
})
```

El backend responde:

```json
{ "ok": true, "result": {} }
```

o:

```json
{ "ok": false, "error": "mensaje" }
```

Funciones permitidas viven en `getApi_()` dentro de `Code.gs`. Si se agrega un endpoint publico, agregarlo ahi.

## Data Model

Sheets:

- `Routines`: `routine_id`, `routine_name`, `created_at`, `is_active`
- `Routine_Days`: `day_id`, `routine_id`, `day_name`, `day_order`, `week_days`
- `Day_Exercises`: `routine_exercise_id`, `day_id`, `exercise_order`, `exercise_name`, `target_sets`, `target_reps_min`, `target_reps_max`, `suggested_weight`, `technique_note`, `muscle_group`
- `Sessions`: `session_id`, `date`, `routine_id`, `day_id`, `bodyweight`, `notes`, `created_at`, `routine_name`, `day_name`
- `Session_Sets`: `set_id`, `session_id`, `routine_exercise_id`, `exercise_name`, `set_number`, `weight`, `reps`, `rir`, `note`, `muscle_group`
- `Exercise_Goals`: `goal_id`, `exercise_name`, `target_weight`, `target_1rm`, `created_at`, `updated_at`

Pesos persistidos siempre en kg. El toggle kg/lb es display/input solamente.

## Estado Actual

- Parte 1 completa: setup, sheets y helpers.
- Parte 2 completa: rutinas CRUD.
- Parte 3 completa: dias y ejercicios CRUD.
- Parte 4 base completa: seleccion de entrenamiento, pantalla train, autosave, kg/lb, series extras, precarga de ultima vez.
- Parte 5 base completa: guardar sesion real, resumen, detalle, edicion y borrado completos.
- Parte 6 iniciada: Home stats reales y ultima sesion clickeable completos.
- Parte 7 base completa: progreso por ejercicio con selector, historial, volumen, delta y tendencia simple.
- Reorder completo: dias y ejercicios tienen flechas arriba/abajo y endpoints `reorderDay` / `reorderExercise`.
- App icon/manifest completo: iconos PNG en `assets/`, `manifest.webmanifest` y tags PWA basicos en `index.html`. Version activa: `v3`, recortada sin borde blanco (`assets/app-icon-192-v3.png`, `assets/app-icon-512-v3.png`, `assets/apple-touch-icon-v3.png`, `manifest.webmanifest?v=3`).
- UX/nav inicial completo: train-pick ajustado para iPhone, bottom nav de 5 items con CTA central, pantalla `screen-history` y endpoint `listRecentSessions`.
- Home ya no muestra volumen semanal. Progreso muestra `Último máx.` del ejercicio en vez de volumen total como metrica principal.
- Modal de ejercicio tiene autocomplete por `listAllExerciseNames()` e inputs numericos optimizados para iPhone.
- Analitica sin schema: `calcSetMetrics_` calcula volumen, peso maximo y 1RM estimado Epley. Summary marca PRs automaticos de peso y/o 1RM comparando contra historial previo. Progreso muestra 1RM estimado por sesion.
- Calendario de actividad base completo: `listSessionDates({ days })` agrupa sesiones por fecha y `screen-history` muestra grilla de 13 semanas con filtro por dia.
- Peso corporal completo: `listBodyweightHistory({ limit })` usa `Sessions.bodyweight`, y `screen-progress` tiene vista segmentada Ejercicio/Peso corporal con grafico SVG y registros clickeables.
- Duplicar rutina completo: `duplicateRoutine({ routine_id, new_name })` clona rutina, dias y ejercicios con IDs nuevos; no copia sesiones.
- Muscle group base completo: `Day_Exercises.muscle_group` con opciones `pecho`, `espalda`, `hombros`, `bicep`, `tricep`, `core`, `piernas`. El modal de ejercicio guarda el grupo y las cards muestran chip. Requiere correr `setup()` tras actualizar Apps Script para agregar la columna.
- Home actual simplificado: funciona como lanzador rapido con CTA de entrenamiento, accesos a Rutinas/Historial, rutina activa y ultima sesion. No mostrar conteos semanales, dias asignados, rachas, volumen ni PRs en Home porque vuelve lenta e innecesariamente cargada la entrada.
- Rutinas/Entrenar/Progreso deben abrir livianos: la lista de rutinas no cuenta dias/ejercicios; Entrenar carga primero rutinas y despues la rutina seleccionada; Progreso carga primero nombres y el historial pesado solo al pedirlo o si esta cacheado.
- El frontend persiste cache de lecturas en `localStorage` (`gymtracker:api-cache:v2`) para que recargas y navegacion entre tabs no dependan siempre de Apps Script.
- Calendario semanal completo: cada dia de rutina puede tener `week_days` ISO (`1,3` = lunes y miercoles). Home, detalle de rutina, detalle de dia y seleccion de entrenamiento muestran chips.
- Streak semanal y resumen semanal quedan como helpers historicos, pero no deben cargarse en Home salvo pedido explicito del usuario.
- Progreso por musculo completo:
  - `listMuscleGroupHistory({ muscle_group, limit })` muestra historial agregado por grupo muscular.
  - `getVolumeByMuscle({ weeks })` alimenta vista **Musculos** con barras apiladas por semana.
  - `getMuscleHeatmap({ days })` alimenta vista **Cuerpo** con SVG frontal+dorsal e intensidad por volumen relativo de los ultimos 30 dias.
  - El SVG del heatmap debe ser anatomico y legible: diferenciar deltoides, pectorales, abdomen, biceps/triceps, dorsales, core posterior y piernas. No volver a figuras geometricas genericas.
  - El grupo muscular principal es obligatorio al crear/editar ejercicios, porque alimenta heatmap y graficos.
- Goals por ejercicio existen en codigo: `Exercise_Goals`, `getExerciseGoal`, `setExerciseGoal`, card de Meta en historial de ejercicio. Mantener salvo que el usuario pida explicitamente sacarlo.
- Auditoria tecnica guardada en `docs/tech-audit.md`. Arreglos aplicados: boot del Home, fecha local, goals tolerantes a hoja faltante, drafts canonicos en kg, validacion de bodyweight, notas preservadas, retorno desde Progreso, snapshots historicos, duplicacion con musculo obligatorio/inferido e historial de 91 dias.
- Snapshots historicos: sesiones nuevas guardan `routine_name`/`day_name`; sets nuevos guardan `muscle_group`. `setup()` corre migracion historica y tambien existe `migrateHistoricalSnapshots()` para backfill manual. La migracion solo recupera datos inferibles desde IDs actuales o nombres equivalentes.
- `docs/pending.md` ya no es fuente activa: queda como archivo historico de pendientes completados. Usar este `MEMORY.md` como fuente de estado.
- Informe de rendimiento completo:
  - `getPerformanceReport({ weeks })` (4-16, default 8) devuelve score global 0-100, 4 componentes, `strength` e `insights`. No requiere columnas nuevas ni `setup()`: deriva todo de sheets existentes.
  - Componentes y pesos: Consistencia 30 (sesiones reales vs `Routine_Days.week_days` de la rutina activa), Progresion 30 (ejercicios subiendo vs `stall_count`), Carga 25 (series efectivas semanales via `getSetMuscleStimuli_` + tendencia primera vs segunda mitad), Intensidad 15 (RIR promedio; se excluye del score si la cobertura es menor a 20% o hay menos de 10 series con RIR). El score global renormaliza sobre los componentes con datos.
  - La ventana se recorta a la semana de tu primera sesion real y se reporta en `effective_weeks`. Sin eso, pedir 16 semanas con 10 entrenadas inventaba semanas vacias y disparaba tendencias falsas tipo `+600%`. El frontend avisa cuando recorta.
  - Sin sesiones en el rango devuelve `emptyPerformanceReport_`: todo en `null`, sin insights. No mostrar score 0.
  - `insights` son reglas ordenadas por prioridad, maximo 6. Incluye el cruce `Nutrition` x PRs (proteina/kcal en semanas con PR vs sin PR), que solo es posible porque nutricion y entrenamiento viven en la misma base.
  - Vive arriba de `screen-progress`, no en Home ni en el bottom nav. Se renderiza con `renderPerformanceReport` y cachea 1800s en back y 600s en front.
  - Los estados nunca se comunican solo por color: `--good` y `--warn` tienen delta-E 1.9 bajo protanopia, asi que cada insight lleva icono y etiqueta de texto. No sacar esas etiquetas.
  - Intensidad no lleva sparkline a proposito: en RIR "mas alto" es peor y se leia al reves junto a las otras dos.

## Ideas Futuras Guardadas

- PWA/offline: por ahora no implementar. Si se retoma, preferir PWA basica primero (instalable + cache de archivos + drafts locales existentes). No hacer sync offline completa sin definir conflictos.
- Backup/export: por ahora no implementar. El Google Sheet ya funciona como backup natural. Si se retoma, preferir Export JSON completo para migracion/respaldo.
- Historial: a futuro se podria agregar filtros por rutina/dia o rangos mas largos si el uso real lo pide.

No implementar features grandes de schema sin avisar que requieren actualizar `Code.gs`, correr/ajustar `setup()` o migrar columnas existentes en Sheets, y redeployar Apps Script.

## Reglas de Implementacion

- Siempre pushear los cambios al terminar una tarea de codigo/docs. No esperar confirmacion extra del usuario para hacer push.
- Mantener estilo mobile-first dark premium.
- No usar tablas visibles.
- Mutaciones de rutina/dia/ejercicio deben devolver la rutina completa cuando eso evita un roundtrip.
- Orden de dias y ejercicios por `*_order`, sin drag-and-drop por ahora.
- Sets vacios se ignoran al guardar sesion.
- Al guardar sesion exitosamente, borrar draft `gymtracker:session-draft:<day_id>:<date>`.
- Si cambia `Code.gs`, avisar que hay que redeployar Apps Script.
- Si cambia `index.html`, avisar que hay que pushear y refrescar GitHub Pages.
- Si cambia `manifest.webmanifest` o assets de icono, avisar que GitHub Pages puede cachear y que iOS puede requerir quitar/agregar de nuevo a Home Screen.

## Señales De Problema

- Error `google.script.run is not defined`: el frontend volvio a depender de Apps Script. Corregir a `fetch`.
- Error `No se encontró el archivo HTML llamado Index`: alguien esta intentando servir HTML desde Apps Script. No corresponde.
- La URL `/exec` abierta directo muestra JSON: eso esta bien. La app se abre desde GitHub Pages.
- La app no conecta al backend: revisar URL `/exec`, deploy nueva version, permisos `Anyone`, y que `Code.gs` tenga `doPost`.
