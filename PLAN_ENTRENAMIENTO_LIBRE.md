# Plan: Entrenamiento libre

## Objetivo

Desde la pantalla **Empezar** (`train-pick`), poder iniciar un "Entrenamiento libre": una sesión que arranca vacía (sin rutina ni día) donde Juan va agregando ejercicios sobre la marcha desde la biblioteca. Todo lo demás (series, pesos previos, draft/autosave, resumen, historial, progreso) debe funcionar igual que una sesión normal.

## Contexto: qué ya existe y se reutiliza

La sesión de Entrenar **ya es flexible**, así que el trabajo es principalmente permitir entrar a `screen-train` sin rutina/día:

- `state.trainExercises` es la lista propia de la sesión; ya soporta agregar/quitar/cambiar ejercicios con ids `adhoc_*` sin tocar la rutina ([index.html:4312-4318](index.html#L4312-L4318), `handleAddTrainExercise` en ~[index.html:4741](index.html#L4741)).
- El picker "+ Agregar ejercicio" ya usa la biblioteca (`listExerciseLibrary`) — se reutiliza tal cual.
- El draft/autosave guarda `exercise_list` completo con key `gymtracker:session-draft:<day_id>:<date>` ([index.html:4509-4532](index.html#L4509-L4532)) — con un `day_id` sentinel `'free'` funciona sin cambios.
- Los pesos previos vienen de `getLastSessionForDay` que devuelve `by_name` **global sin filtro por día** ([Code.gs:1711](Code.gs#L1711)) — los ejercicios de una sesión libre muestran los últimos pesos por nombre automáticamente.
- Las sesiones guardan `routine_name` y `day_name` desnormalizados en la sheet Sessions ([Code.gs:1847-1848](Code.gs#L1847-L1848)), y todos los lectores (historial, resumen, progreso, editSession) hacen fallback `session.day_name || day.day_name` — una sesión con `routine_id`/`day_id` vacíos se muestra bien en todos lados.

## Diseño

**Sentinel:** `FREE_DAY_ID = 'free'`. Una sesión libre se identifica en el frontend por `params.free` y en el backend por `day_id === 'free'` en `getLastSessionForDay` y por `params.free === true` en `saveSession`.

**En la sheet Sessions** la sesión libre se guarda con `routine_id: ''`, `day_id: ''`, `routine_name: ''`, `day_name: 'Entrenamiento libre'`. Así el historial muestra "Entrenamiento libre" sin tocar ningún renderer.

---

## Cambios en `index.html`

### 1. UI en train-pick

Agregar una card "Entrenamiento libre" en `#screen-train-pick`, debajo de los controles de fecha/rutina y antes de la sección "Elegí el día" ([index.html:1917-1919](index.html#L1917-L1919)):

```html
<button class="ghost-btn full" data-action="start-free-train" style="margin: 4px 0 0;">
  🏃 Entrenamiento libre — agregá ejercicios sobre la marcha
</button>
```

(Estilo a criterio del implementador: puede ser una `day-card` destacada en vez de un botón, pero que no compita visualmente con los días de la rutina. Usa la fecha ya elegida en `#tp-date`.)

### 2. Handler del click

En el dispatcher de `data-action` (cerca de `case 'go-train'` [index.html:6019](index.html#L6019)):

```js
case 'start-free-train': {
  const date = $('#tp-date').value || todayInputValue();
  goTo('train', { free: '1', date });
  break;
}
```

### 3. `registerScreen('train')` acepta modo libre

En [index.html:4172-4180](index.html#L4172-L4180): si `params.free`, llamar a `startFreeTraining({ date, navToken })` en vez de exigir `routine_id`/`day_id`:

```js
registerScreen('train', {
  async onEnter(params, navToken) {
    const date = params && params.date;
    if (params && params.free) {
      if (!date) { goTo('train-pick'); return; }
      await startFreeTraining({ date, navToken });
      return;
    }
    // ... flujo actual con routine_id/day_id
  }
});
```

### 4. Nueva función `startFreeTraining`

Espejo de `startTraining` ([index.html:4298](index.html#L4298)) pero sin rutina/día:

```js
const FREE_DAY_ID = 'free';

async function startFreeTraining({ date, navToken }) {
  state.currentRoutine = null;
  state.currentDay = null;
  state.lastSetsByExercise = {};
  state.lastSetsByName = {};
  state.trainProgressByName = {};
  state.trainDataLoaded = false;

  state.trainExercises = [];
  const draft = loadSessionDraft(FREE_DAY_ID, date);
  if (draft && Array.isArray(draft.exercise_list) && draft.exercise_list.length) {
    state.trainExercises = draft.exercise_list.map(ex => Object.assign({}, ex));
  }

  $('#train-day-name').textContent = 'Entrenamiento libre';
  $('#train-meta').textContent = formatDateLong(date);
  renderTrainExercises(state.trainExercises);

  if (draft) {
    restoreTrainDraft(draft);
    toast('Continuando sesión', 'success');
  }
  bindTrainAutosave(FREE_DAY_ID, date);
  loadLastSetsForTraining(FREE_DAY_ID, date, navToken);
}
```

Notas:
- Los ejercicios agregados usan el flujo existente de `handleAddTrainExercise` — nada que cambiar ahí, pero **verificar** que no dependa de `state.currentDay`/`state.currentRoutine` (revisar la función completa ~[index.html:4720-4900](index.html#L4720-L4900); si usa `state.currentDay.exercises` para marcar "usados", tolerar null).
- `loadLastSetsForTraining` ([index.html:4337](index.html#L4337)) compara `state.screenParams.day_id !== day_id` para descartar respuestas viejas — en modo libre `screenParams.day_id` es undefined. Ajustar el guard para modo libre (p. ej. comparar contra `state.screenParams.free ? FREE_DAY_ID : state.screenParams.day_id`).

### 5. Empty state en la pantalla de entrenamiento

`renderTrainExercises([])` con lista vacía: verificar qué renderiza hoy. Para modo libre debe mostrar un empty state amigable arriba del botón "+ Agregar ejercicio" (que ya existe en [index.html:4396](index.html#L4396)):

> 🏋️ "Arrancá agregando tu primer ejercicio"

### 6. `buildSavePayload` en modo libre

Hoy lanza error si falta rutina/día ([index.html:4547-4550](index.html#L4547-L4550)). Cambiar a:

```js
function buildSavePayload() {
  const isFree = !!(state.screenParams && state.screenParams.free);
  const r = state.currentRoutine;
  const day = state.currentDay;
  if (!isFree && (!r || !day)) throw new Error('Falta rutina o día.');
  // ... resto igual
  return {
    date: state.screenParams.date,
    routine_id: isFree ? '' : r.routine_id,
    day_id: isFree ? '' : day.day_id,
    free: isFree,
    notes: '',
    exercises,
  };
}
```

### 7. `handleSaveSession` — limpiar el draft correcto

En [index.html:5023](index.html#L5023): `clearSessionDraft(payload.free ? FREE_DAY_ID : payload.day_id, payload.date)`.

### 8. Resumen (summary)

`state.lastSummary` viene del backend; con los nombres que devuelve el backend (ver abajo) el resumen muestra "Entrenamiento libre" sin cambios. Verificar que `renderSummary` no explote con `routine_name` vacío.

---

## Cambios en `Code.gs`

### 1. `saveSession` acepta `free: true`

En [Code.gs:1817-1849](Code.gs#L1817-L1849), cuando `params.free` es truthy:
- No exigir ni validar `routine_id`/`day_id`.
- Guardar la fila de Sessions con `routine_id: ''`, `day_id: ''`, `routine_name: ''`, `day_name: 'Entrenamiento libre'`.
- Para `buildSessionSummary_(session, prepared.exercises, routine, day)` ([Code.gs:1871](Code.gs#L1871)): pasar objetos sintéticos `{ routine_name: '' }` y `{ day_name: 'Entrenamiento libre' }` (revisar qué campos usa esa función y cubrirlos).

El resto (validación de sets, lock, appendRows a Session_Sets, muscle_distribution) queda igual.

### 2. `getLastSessionForDay` acepta `day_id: 'free'`

En [Code.gs:1711-1722](Code.gs#L1711-L1722): si `day_id === 'free'`, saltear la búsqueda del día y usar `exercises = []` (no hay ejercicios "del día"). El resto de la función construye `by_name` desde todas las sesiones — eso es exactamente lo que necesita el modo libre. Verificar que el shape de retorno con `exercises: {}` vacío no rompa al cliente (el cliente ya tolera ejercicios que solo matchean por nombre).

### 3. Lectores de Sessions — solo verificar, no debería hacer falta tocar

Sesiones con `routine_id`/`day_id` vacíos y `day_name: 'Entrenamiento libre'`:
- Historial / `session-detail` / `session-edit`: usan `session.day_name || day.day_name` → OK.
- `getProgressSummary`: agrega por nombre de ejercicio, incluye adhoc → OK.
- `getWeekActivity` / `getHomeStats`: verificar que no filtren por `routine_id` válido.
- `editSession` ([Code.gs:1992-1993](Code.gs#L1992-L1993)): fallback a nombres existentes → OK.
- `migrateHistoricalSnapshots_` ([Code.gs:310-327](Code.gs#L310-L327)): las sesiones libres van a contar como `sessions_unresolved` (routine_name vacío). Es cosmético; si molesta, excluir sesiones con `day_name === 'Entrenamiento libre'` del conteo.

---

## Orden de implementación sugerido

1. Backend: `saveSession` con `free`, `getLastSessionForDay` con `'free'`.
2. Frontend: card + handler + `startFreeTraining` + ajustes de `buildSavePayload`/`handleSaveSession`/guard de `loadLastSetsForTraining`.
3. Empty state y verificación de `handleAddTrainExercise` sin `currentDay`.
4. Probar flujo completo: iniciar libre → agregar 2 ejercicios (uno de biblioteca, uno nuevo) → cargar series → recargar página (draft se restaura) → guardar → resumen → verificar en Historial y Progreso.

## Recordatorios

- **Redesplegar el Web App de GAS manualmente** después de tocar `Code.gs` (misma URL de deploy).
- El cliente tiene fallback si el GAS viejo no soporta algo (`cachedGasBatch`) — pero `saveSession` con `free` contra un GAS viejo va a fallar con "routine_id requerido", así que desplegar backend **antes** de usar el frontend nuevo.
- Toda escritura invalida caches vía `invalidateSessionCaches()` — ya lo hace `handleSaveSession`, sin cambios.
