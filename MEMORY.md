# Shym Project Memory

Esta es la biblia corta del proyecto. Si algo contradice esto, confiar primero en este archivo y despues verificar el codigo.

## Arquitectura Canonica

Este repo contiene **dos apps independientes que no comparten backend ni datos**:

- **Shym** (vieja, congelada): GitHub Pages + Apps Script + Google Sheets. Vive en la raiz del repo: `index.html`, `manifest.webmanifest`, `assets/`. Sigue funcionando para el usuario tal cual estaba. **No se edita mas.** Ningun cambio de codigo/feature se aplica aca salvo pedido explicito.
- **Shymie** (nueva, activa): Cloudflare Workers + D1. Vive en `public/` (frontend) y `src/` (backend). **Todo el desarrollo nuevo va aca.**

Las dos comparten el mismo modelo de datos y la misma logica de negocio de origen (`Code.gs`), pero corren por separado: distinto dominio, distinto storage del navegador, distinto token, sin sync entre ellas. Runbook de puesta en marcha de Shymie: `docs/migracion-cloudflare.md`.

### Shymie — como esta armada

- Frontend y API comparten origen. No hay CORS, no hay URL de backend que configurar.
- El frontend canonical de Shymie es `public/index.html`. El Worker lo sirve via el binding `ASSETS`.
- El backend es `src/index.js`, que expone `POST /api`.
- `src/api.js` es **generado**: sale de `Code.gs` via `npm run port`. No editarlo a mano.
- `Code.gs` sigue siendo la fuente de la logica de negocio (para eso lo lee el port), pero ya no se redeploya a Apps Script: esa via quedo congelada junto con Shym.
- El acceso se controla con un token compartido en el header `X-Shymie-Token`, guardado en `localStorage` con key `gymtracker:token`. El secreto vive en Worker Secrets como `SHYMIE_TOKEN`.
- Si falta `SHYMIE_TOKEN`, la API responde 503 a todo. Un deploy sin secreto queda cerrado, no abierto.
- `google.script.run` y `HtmlService` estan prohibidos en Shymie. Tambien lo esta agregar llamadas a Google Sheets ahi.

### Ciclo de request (Shymie)

La logica de negocio portada es sincrona y D1 es asincrono. Cada request hace:

1. **load** — una lectura trae las tablas a memoria (`Store.load`).
2. **logica** — corre sincrona: lee de memoria, y las escrituras mutan memoria y se encolan.
3. **flush** — la cola se manda en un unico `d1.batch()`, que D1 corre como transaccion.

Por eso `LockService` desaparecio: el batch da atomicidad. El shim no-op en `src/api.js` existe para no reestructurar los `try/finally` de las 6 funciones que lo usaban.

### Invariantes del port (no romper)

- **Celda vacia es `''`, nunca `null`.** `db.js` convierte `NULL -> ''` al leer. La logica hace `weight === '' ? null : Number(weight)` en mas de veinte lugares; con `null`, `Number(null)` da `0` y una serie sin peso contaria como 0 kg.
- **`is_active` y `trained` vuelven como booleano nativo.** `getTrainPickData` hace `routines.find(r => r.is_active)` sin `isTrue_`: el string `'false'` seria truthy.
- **La zona horaria es explicita.** Los Workers corren en UTC. La var `TZ` de `wrangler.toml` (`America/Argentina/Buenos_Aires`) alimenta `todayIso_`. Sin eso las fechas de sesion se corren un dia y con ellas la racha, el calendario y el resumen semanal.
- **No hay cache de servidor.** Se elimino con la migracion: existia porque Apps Script tardaba 1-3 s y con D1 solo agregaba staleness. El cache de `localStorage` del frontend se mantiene.

## Deploy Correcto

### Shymie

Un solo comando:

```bash
npx wrangler deploy
```

Si cambio el schema:

```bash
npm run db:schema                              # regenera migrations/ desde src/schema.js
npx wrangler d1 migrations apply shymie --remote
```

Si cambio la logica de negocio: editar `Code.gs`, despues `npm run port && npm test`, despues deploy.

No hay que copiar y pegar nada a mano, ni redeployar web apps, ni pushear a GitHub Pages para que Shymie se actualice.

### Shym

No se redeploya. Quedo congelada con lo que ya tenia. Si alguna vez el usuario pide explicitamente reactivar el mantenimiento de Shym, seguir el proceso viejo: pegar `Code.gs` en Apps Script y hacer New version deploy, y pushear la raiz del repo para GitHub Pages.

## Contrato API (Shymie)

El frontend manda:

```js
fetch('/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shymie-Token': token,
  },
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

El contrato `{ fn, args }` es el mismo de antes: por eso el frontend casi no cambio.
`401` significa token invalido y el frontend lo limpia y vuelve a la pantalla de conexion.

Funciones permitidas viven en `API` dentro de `src/api.js`, que el port genera desde `getApi_()` de `Code.gs`. Si se agrega un endpoint publico, agregarlo a `getApi_()` **y** a la lista `API` del footer en `tools/port-code-gs.mjs`.

## Data Model

Tablas en D1 (definidas en `src/schema.js`, que genera el DDL y el mapeo de tipos):

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
- Muscle group base completo: `Day_Exercises.muscle_group` con opciones `pecho`, `espalda`, `hombros`, `bicep`, `tricep`, `core`, `piernas`. El modal de ejercicio guarda el grupo y las cards muestran chip. La columna ya existe en el schema de D1.
- Home actual simplificado: funciona como lanzador rapido con CTA de entrenamiento, accesos a Rutinas/Historial, rutina activa y ultima sesion. No mostrar conteos semanales, dias asignados, rachas, volumen ni PRs en Home porque vuelve lenta e innecesariamente cargada la entrada.
- Rutinas/Entrenar/Progreso deben abrir livianos: la lista de rutinas no cuenta dias/ejercicios; Entrenar carga primero rutinas y despues la rutina seleccionada; Progreso carga primero nombres y el historial pesado solo al pedirlo o si esta cacheado.
- El frontend persiste cache de lecturas en `localStorage` (`gymtracker:api-cache:v2`) para que recargas y navegacion entre tabs no dependan siempre de la red.
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
- Snapshots historicos: sesiones nuevas guardan `routine_name`/`day_name`; sets nuevos guardan `muscle_group`. `migrateHistoricalSnapshots()` sigue disponible como endpoint para backfill manual. La migracion solo recupera datos inferibles desde IDs actuales o nombres equivalentes.
- `docs/pending.md` ya no es fuente activa: queda como archivo historico de pendientes completados. Usar este `MEMORY.md` como fuente de estado.
- Informe de rendimiento completo:
  - `getPerformanceReport({ weeks })` (4-16, default 8) devuelve score global 0-100, 4 componentes, `strength` e `insights`. No requiere columnas nuevas: deriva todo de las tablas existentes.
  - Componentes y pesos: Consistencia 30 (sesiones reales vs `Routine_Days.week_days` de la rutina activa), Progresion 30 (ejercicios subiendo vs `stall_count`), Carga 25 (series efectivas semanales via `getSetMuscleStimuli_` + tendencia primera vs segunda mitad), Intensidad 15 (RIR promedio; se excluye del score si la cobertura es menor a 20% o hay menos de 10 series con RIR). El score global renormaliza sobre los componentes con datos.
  - La ventana se recorta a la semana de tu primera sesion real y se reporta en `effective_weeks`. Sin eso, pedir 16 semanas con 10 entrenadas inventaba semanas vacias y disparaba tendencias falsas tipo `+600%`. El frontend avisa cuando recorta.
  - Sin sesiones en el rango devuelve `emptyPerformanceReport_`: todo en `null`, sin insights. No mostrar score 0.
  - `insights` son reglas ordenadas por prioridad, maximo 6. Incluye el cruce `Nutrition` x PRs (proteina/kcal en semanas con PR vs sin PR), que solo es posible porque nutricion y entrenamiento viven en la misma base.
  - Vive arriba de `screen-progress`, no en Home ni en el bottom nav. Se renderiza con `renderPerformanceReport` y cachea 1800s en back y 600s en front.
  - Los estados nunca se comunican solo por color: `--good` y `--warn` tienen delta-E 1.9 bajo protanopia, asi que cada insight lleva icono y etiqueta de texto. No sacar esas etiquetas.
  - Intensidad no lleva sparkline a proposito: en RIR "mas alto" es peor y se leia al reves junto a las otras dos.

- Objetivo del ejercicio visible al entrenar:
  - Cada card de `screen-train` muestra un chip `Objetivo` con `target_sets × target_reps_min–target_reps_max reps · suggested_weight`, leido de `Day_Exercises` (o de `Exercise_Library` cuando el ejercicio se agrega ad-hoc/entrenamiento libre).
  - Helpers: `trainTargetOf_(ex)` normaliza el objetivo (peso `null`/`''`/`0` = sin sugerencia, siempre en kg) y `formatTrainTarget_(ex)` arma el texto. El chip se oculta si no hay ni reps ni peso.
  - Los placeholders de peso y reps de cada serie priorizan la ultima vez; si no hay historial caen al objetivo guardado en `Day_Exercises`. El `aria-label` aclara si es "ultima vez" o "sugerido/objetivo".
  - El tip de primera vez usa el peso sugerido cuando existe (`Primera vez: arranca con X kg...`).
  - Objetivo (plan guardado) y tip (derivado del historial) son cosas distintas y conviven en `.train-chips`. No fusionarlos.
  - Es solo frontend. Drafts viejos sin `suggested_weight` degradan a mostrar solo reps.

## Ideas Futuras Guardadas

- PWA/offline: por ahora no implementar. Si se retoma, preferir PWA basica primero (instalable + cache de archivos + drafts locales existentes). No hacer sync offline completa sin definir conflictos.
- Backup/export: Shymie perdio el Sheet como backup natural. Opciones: `wrangler d1 export shymie --remote --output backup.sql`, o un endpoint de export JSON. D1 tambien tiene point-in-time recovery de 30 dias.
- Historial: a futuro se podria agregar filtros por rutina/dia o rangos mas largos si el uso real lo pide.

No implementar features grandes de schema sin avisar que requieren tocar `src/schema.js`, generar una migracion nueva en `migrations/` y aplicarla con `wrangler d1 migrations apply`.

## Reglas de Implementacion

- Siempre pushear los cambios al terminar una tarea de codigo/docs. No esperar confirmacion extra del usuario para hacer push.
- Nunca tocar `index.html`, `manifest.webmanifest` o `assets/` en la raiz del repo (son de Shym, congelada), salvo pedido explicito del usuario. El desarrollo nuevo va en `public/` y `src/` (Shymie).
- Mantener estilo mobile-first dark premium.
- No usar tablas visibles.
- Mutaciones de rutina/dia/ejercicio deben devolver la rutina completa cuando eso evita un roundtrip.
- Orden de dias y ejercicios por `*_order`, sin drag-and-drop por ahora.
- Sets vacios se ignoran al guardar sesion.
- Al guardar sesion exitosamente, borrar draft `gymtracker:session-draft:<day_id>:<date>`.
- Si cambia la logica de negocio: editar `Code.gs`, correr `npm run port && npm test`, y despues `npx wrangler deploy`.
- Nunca editar `src/api.js` a mano: es generado y el proximo port lo pisa.
- Si cambia `src/schema.js`, regenerar migraciones con `npm run db:schema` y aplicarlas antes de deployar.
- Si cambia `public/index.html` o `public/assets/`, alcanza con `npx wrangler deploy`.
- Si cambia `manifest.webmanifest` o assets de icono, avisar que iOS puede requerir quitar/agregar de nuevo a Home Screen.

## Señales De Problema

- Todo responde `503 Backend sin SHYMIE_TOKEN configurado`: falta el secreto. Correr `npx wrangler secret put SHYMIE_TOKEN`.
- Todo responde `401`: el token del navegador no coincide con el del Worker. El frontend lo borra solo y vuelve a la pantalla de conexion.
- Error `Falta el binding DB de D1`: falta el `database_id` en `wrangler.toml`, o no se corrieron las migraciones.
- `getSheet_ is not defined` o similar: alguien edito `src/api.js` a mano, o el port quedo desactualizado. Correr `npm run port`, que ademas chequea referencias colgadas.
- Las fechas aparecen corridas un dia: se perdio la var `TZ` de `wrangler.toml`.
- Una serie sin peso cuenta como 0 kg en el volumen: se rompio la conversion `NULL -> ''` de `src/db.js`.
- `GET /api` abierto directo muestra JSON: eso esta bien, es el healthcheck.
