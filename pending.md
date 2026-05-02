# Pending — Gym Tracker

Estado y plan de trabajo restante. Última actualización: 2026-05-01.

---

## Estado actual

**Hecho:**
- ✅ **Parte 1** — Esqueleto + data layer. 5 sheets, helpers de lectura/escritura, `setup()`, `ping()`.
- ✅ **Parte 2** — Rutinas CRUD. Backend: `listRoutines`, `createRoutine`, `renameRoutine`, `setActiveRoutine`, `deleteRoutine`, `getRoutine`. Frontend: pantalla Rutinas + Detalle con renombrar/activar/borrar.
- ✅ **Refactor a arquitectura híbrida** — Backend como API JSON (Apps Script `doGet`/`doPost`) + frontend estático en GitHub Pages. URL: https://juandeeezcurra.github.io/shym/. Configuración del backend vía pantalla de setup que persiste en `localStorage`.
- ✅ **Fix arquitectura híbrida real** — `Code.gs` expone API JSON (`doPost`) y `index.html` usa `fetch` contra la URL `/exec` guardada en `localStorage`. Ya no hace falta pegar HTML en Apps Script.
- ✅ **Parte 3** — Días + Ejercicios CRUD. Backend y frontend completos: crear/renombrar/borrar días, crear/editar/borrar ejercicios, validaciones, grid de días, pantalla detalle de día y modal reutilizable de ejercicio.
- ✅ **Parte 4 base completa** — Selección de entrenamiento + precarga: `getActiveRoutine`, `getLastSessionForDay`, pantalla `train-pick`, pantalla `train`, autosave local, toggle kg/lb y series extras.
- ✅ **Parte 5 base completa** — Guardado real de sesión + resumen post-entreno + detalle/edición/borrado de sesión.
- 🟡 **Parte 6 iniciada** — Home con stats reales y última sesión clickeable.

**Vivo en producción (asumiendo deploy hecho):**
- App: https://juandeeezcurra.github.io/shym/
- Repo: https://github.com/Juandeeezcurra/shym
- Frontend canonical: `index.html` en GitHub Pages. No usar `Index.html`.
- Backend canonical: `Code.gs` en Apps Script como API JSON.

---

## Pasos pendientes del usuario (one-time)

Cada vez que cambie `Code.gs`, hace falta:
1. Copiar `Code.gs` desde [raw GitHub](https://raw.githubusercontent.com/Juandeeezcurra/shym/main/Code.gs)
2. Pegar en Apps Script (reemplazando el contenido)
3. 💾 Guardar
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**
5. Web app config: **Execute as: Me** y **Access: Anyone**

Nunca pegar `index.html` en Apps Script. `index.html` se actualiza solo en GitHub Pages después del push (refresh y listo). Si la app pide backend, pegar en la pantalla de setup la URL del deploy de Apps Script que termina en `/exec`.

---

## Por hacer

### Parte 3 — Días + Ejercicios CRUD

**Estado:** completada el 2026-05-01.

**Backend (`Code.gs`):**
- `addDay({ routine_id, day_name })` — calcula `day_order` siguiente, retorna `getRoutine` actualizado
- `renameDay({ day_id, new_name })`
- `deleteDay({ day_id })` — cascade a ejercicios; sesiones intactas
- `addExercise({ day_id, exercise_name, target_sets, target_reps_min, target_reps_max, suggested_weight, technique_note })`
- `updateExercise({ routine_exercise_id, ...campos })`
- `deleteExercise({ routine_exercise_id })`

Cada mutación devuelve el `getRoutine` completo para que el frontend re-renderice sin roundtrip extra.

**Frontend (`index.html`):**
- Cuando hay días, renderizar grid 2-col en `screen-routine-detail` con cada día (nombre + count de ejercicios)
- Habilitar botón "+ Día" → modal con input de nombre
- Nueva pantalla `screen-day-detail` con back button, lista de ejercicios, "+ Ejercicio", acciones (Renombrar día / Borrar día)
- Modal de ejercicio (create + edit comparten el mismo): nombre, sets objetivo (default 4), reps min (8), reps max (12), peso sugerido (opcional), nota técnica (opcional)

**Validaciones backend:**
- Nombre día: 1-50 chars
- Nombre ejercicio: 1-100 chars
- target_sets: 1-20
- target_reps_min ≤ target_reps_max, ambos 1-100
- suggested_weight: opcional, ≥ 0

**Decisión locked:** sin drag-and-drop. Orden por `*_order` auto-incrementales.

---

### Parte 4 — Entrenar (selección + precarga)

**Estado:** iniciada el 2026-05-01. Falta probar contra Apps Script deployado y ajustar detalles visuales/UX si aparece algo en celular.

**Backend:**
- ✅ `getLastSessionForDay({ day_id, date })` — para cada `routine_exercise_id` del día, devuelve las series de la última sesión previa (date < fecha elegida) que use ese mismo `rex_id`.
- ✅ `getActiveRoutine()` — atajo, devuelve la rutina marcada `is_active`. Si ninguna, lanza error claro.

**Frontend:**
- ✅ Pantalla `screen-train-pick`: botón "Empezar entrenamiento" del Home arranca acá:
  - Input fecha (default hoy, editable)
  - Selector de rutina (default: activa)
  - Cards de días disponibles (al elegir → arranca train)
  - Selector de unidades kg/lb
- ✅ Pantalla `screen-train`: la sesión en curso
  - Header con día + fecha + botón cambiar
  - Card de bodyweight (opcional)
  - Por cada ejercicio:
    - Header con nombre + objetivo (sets · reps) + peso sugerido
    - Chips "Última vez" si hay datos previos
    - Grid de inputs: kg / reps / RIR por set (cantidad = `target_sets`)
    - Field opcional de nota
  - Botón flotante "Guardar sesión"
- ✅ **localStorage autosave:** key `gymtracker:session-draft:<day_id>:<date>`, se escribe debounced en cada input. Al entrar al train screen, si hay draft para ese day+date, se restaura con toast "Continuando sesión".
- ✅ **Toggle kg/lb cableado:** los inputs respetan `units.current`.
- ✅ Parte 5 conectada: al guardar exitosamente, limpia draft y convierte/envía pesos a kg.

**Decisión locked:** sets generados según `target_sets`. Si querés agregar series extras durante el entrenamiento, botón "+ serie" debajo del último set.

---

### Parte 5 — Guardar sesión + Resumen

**Estado:** base completa el 2026-05-01. Guardar sesión real, summary, detalle, edición y borrado ya implementados.

**Backend:**
- ✅ `saveSession({ date, routine_id, day_id, bodyweight, notes, exercises: [{ routine_exercise_id, exercise_name, sets: [{ weight, reps, rir, note }] }] })` — escribe `Sessions` + `Session_Sets`, filtra sets vacíos (kg+reps ambos null). Devuelve `{ session, summary }`.
- ✅ `getSession({ session_id })` — devuelve sesión con sets agrupados por ejercicio
- ✅ `deleteSession({ session_id })` — borra sesión + todos sus sets
- ✅ `editSession({ session_id, ...campos editables })` — permite cambiar fecha, notes, bodyweight, sets

**Backend lógica de resumen:**
Por cada ejercicio guardado, comparar contra última sesión previa con mismo `routine_exercise_id`:
```
volumen = Σ(weight × reps)
peso_max = max(weight)
reps_totales = Σ(reps)

estado:
  sin sets vs anterior → "Mejoró" (es la primera vez registrada con datos)
  volumen actual > anterior y peso_max ≥ anterior → "Mejoró"
  volumen ±5% del anterior y peso_max ≥ anterior → "Igual"
  volumen < anterior - 5% → "Bajó"
  no hay sesión anterior → "Sin datos previos"

sugerencia (basada en target_reps_max):
  todas las series alcanzaron target_reps_max → "Subir carga próxima vez"
  todas dentro del rango → "Mantener carga, cerrar el rango"
  alguna debajo de target_reps_min → "Repetir o bajar; revisar fatiga/técnica"
```

**Frontend:**
- ✅ Botón Guardar sesión llama a `saveSession`, limpia draft y navega a resumen
- ✅ Pantalla `screen-summary`: hero con día + fecha + volumen total + delta vs anterior
- ✅ Por ejercicio: card con sets de hoy, estado (pill), sugerencia (con dot de color)
- ✅ Botones: "Volver al Home", "Entrenar otro día"
- ✅ Pantalla `screen-session-detail`: abre la última sesión desde Home, muestra sets y permite borrar
- ✅ Pantalla `screen-session-edit`: vista similar a train pero con datos cargados, botón "Guardar cambios"

**Decisión locked:** sets vacíos (sin kg ni reps) se ignoran al guardar. No se requiere completar todos.

---

### Parte 6 — Home dashboard real

**Estado:** iniciada el 2026-05-01. Stats reales y última sesión ya implementados.

**Backend:**
- ✅ `getHomeStats()` — calcula:
  - `sesiones_semana`: count de sesiones cuya fecha cae en la semana actual (lunes-domingo)
  - `volumen_semana`: Σ(weight × reps) de todas las series de esas sesiones
  - `ejercicios_en_progreso`: count de `exercise_name` distintos que aparecen en sesiones de los últimos 14 días
  - `marcas_mejoradas`: count de `routine_exercise_id` cuya última sesión superó la anterior en volumen total
  - `last_session`: última sesión (si existe), con day_name + routine_name + volumen + conteos

**Frontend:**
- ✅ Reemplazar placeholders del Home con números reales
- ✅ Card "Última sesión" con info real y tap para abrir detalle
- ✅ Si no hay sesiones todavía: empty state

**Decisión locked:** semana = lunes a domingo en timezone del script.

---

### Parte 7 — Progreso por ejercicio

**Backend:**
- `listAllExerciseNames()` — distinct `exercise_name` que aparecen en `Day_Exercises` o `Session_Sets`
- `listExerciseHistory({ exercise_name, limit })` — últimas `limit` sesiones con ese ejercicio. Por sesión devuelve fecha + sets + volumen + peso_max + delta vs anterior

**Frontend:**
- Selector de ejercicio (datalist con todos los nombres)
- Lista de sesiones recientes (default 8)
- Por cada sesión: dot de tendencia (verde/amarillo/rojo) + fecha + resumen en una línea (`70×6,6,5,5`)
- Pill "Tendencia positiva/negativa/estable" arriba calculada sobre las últimas 4 sesiones

**Decisión locked:** MVP solo muestra historial. Sin gráficos. Sin filtros por rutina/día (eso si llega después, en Parte 8 hipotética).

---

## Decisiones todavía abiertas (para discutir cuando vuelva)

1. **PWA / Offline:** ¿agregamos manifest.json + service worker para que la app funcione offline y se instale como app real desde Safari? Costo: ~30 min. Beneficio: si entrenás en un sótano sin señal, igual podés cargar la sesión y sincroniza después. Sin esto, sin internet la app no abre.

2. **Auth simple:** la URL del Apps Script `/exec` es accesible para cualquiera que la tenga. Si te da paranoia que alguien la "encuentre" y meta basura en tu Sheet, agregamos un shared secret hardcodeado en `index.html` que el backend valida. ~10 líneas.

3. **Notas pre-sesión vs post-sesión:** el spec dice "nota general del ejercicio" pero no aclara cuándo se carga. Asumo que se carga durante el entrenamiento y queda persistida en `Session_Sets.note` por set. Si querés notas a nivel ejercicio (no set), se agrega una columna `Sessions.exercise_notes` o algo similar.

4. **Reorder de días/ejercicios:** lo dejé fuera del MVP. Si en algún momento te molesta no poder reordenar, agregamos arrows ↑↓ en cada item (15 min cada uno).

5. **Backup / export:** el Sheet ya es backup natural. ¿Querés un botón "Exportar JSON" en settings? Útil si querés migrar a otra herramienta más adelante.

---

## Plan de ejecución (cuando esté solo)

Voy en este orden, commit + push después de cada parte para que veas el progreso:

1. Parte 3 (días + ejercicios)
2. Parte 4 (entrenar — el grueso)
3. Parte 5 (guardar + summary)
4. Parte 6 (home real)
5. Parte 7 (progreso)

Tests funcionales que voy a verificar mentalmente en cada parte (no hay test runner — single-user, riesgo aceptable):
- Parte 3: crear rutina → agregar día → agregar ejercicio → editar → borrar; cascadas funcionan
- Parte 4: precarga muestra última vez correcta; autosave restaura; sets extras
- Parte 5: guardar genera summary correcto en todos los estados (Mejoró/Igual/Bajó/Sin datos)
- Parte 6: stats coinciden con datos manualmente verificados en el Sheet
- Parte 7: historial ordenado correctamente

---

## Riesgos / cosas que pueden romperse

- **Apps Script timeout:** si la sheet tiene >10k filas, `readAll_` lee todo. Para MVP no es problema, pero a futuro hay que paginar o usar `getRangeByName`.
- **Concurrencia:** dos pestañas simultáneas escribiendo pueden generar IDs duplicados en teoría (UUID minimiza el riesgo). Single-user, riesgo bajo.
- **Cache del navegador:** GitHub Pages cachea agresivamente. Si el usuario no ve cambios después del push, pedir "hard refresh" (Cmd+Shift+R en desktop, en iPhone Safari: Settings → Safari → Clear History).
- **Apps Script deployments:** si el usuario olvida hacer "New version" después de pegar Code.gs nuevo, el backend sigue corriendo el código viejo. Hay que recordárselo en cada cambio backend.
