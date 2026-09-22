# Spec: Módulo de Nutrición + Autoajuste de peso

Brief para implementar en el Gym Tracker (Google Apps Script backend + HTML frontend).
Objetivo: completar el módulo de nutrición que hoy está declarado pero sin implementar.

---

## Contexto

La app es un tracker de gym single-user (Apps Script + Sheets como DB + frontend HTML servido en GitHub Pages que llama al `/exec` vía `doPost`). El backend expone funciones a través del objeto `getApi_()` y el patrón `runApiCall_`. Toda escritura debe estar registrada en `WRITE_API_` para invalidar el cache; toda lectura cacheable en `READ_API_CACHE_SECONDS_`.

**Estado actual del tema nutrición:**
- La pestaña `Nutrition` YA está declarada en `SHEETS` y `HEADERS` con columnas: `date, weight, water, kcal, protein, fat, carbs, steps, notes, trained`.
- NO existe ninguna función que lea o escriba en esa pestaña. Está huérfana.
- El peso corporal hoy se guarda solo dentro de las sesiones de gym (`Sessions.bodyweight`). Los días sin entrenar no hay dónde registrarlo.
- El frontend tiene 4 secciones (Inicio, Entrenar, Progreso, Historial). No hay pantalla de nutrición.

**Lo que hay que construir:** las funciones de backend para la pestaña `Nutrition`, la lógica de autoajuste de peso, y una pantalla nueva en el frontend.

**Importante — no romper nada:** el módulo de gym está completo y funciona. NO tocar funciones existentes de rutinas, sesiones, progreso ni muscle heatmap. Este módulo es aditivo. El peso de nutrición es un registro APARTE del peso de las sesiones de gym — el promedio semanal usa SOLO los pesos de la pestaña `Nutrition`, nunca los de `Sessions`.

---

## Reglas de datos

- La pestaña `Nutrition` usa `date` (formato `yyyy-MM-dd`) como **clave natural**: un solo registro por día. Las escrituras son **upsert** — si ya existe una fila para esa fecha, se actualiza; si no, se crea. No usar IDs generados.
- Reusar los helpers existentes: `readAll_`, `appendRow_`, `updateRowById_` (con `date` como idCol), `todayIso_`, `normalizeOptionalNumber_`, `json_`.
- Pesos siempre en kg (consistente con el resto de la app; el toggle kg/lb es solo display en el front).
- Campos obligatorios al registrar: ninguno individualmente, pero al menos uno de `weight` o `kcal` debe venir (no guardar filas vacías).
- Campos numéricos opcionales que pueden venir vacíos: `water, fat, carbs, steps`.
- `trained`: booleano opcional (si el usuario marca que entrenó ese día).

---

## Backend — funciones a agregar

Agregar estas al objeto `getApi_()`, registrar las de escritura en `WRITE_API_` y las de lectura en `READ_API_CACHE_SECONDS_`.

### 1. `saveNutritionDay(params)` — WRITE

Upsert de un registro diario.

**params:** `{ date?, weight?, kcal?, protein?, fat?, carbs?, water?, steps?, notes?, trained? }`
- `date` opcional; si no viene, usar `todayIso_()`.
- Validar: al menos uno de `weight` o `kcal` presente, si no → throw `'Cargá al menos peso o calorías.'`
- Validar `weight > 0` si viene (reusar criterio de `validateBodyweight_`).
- Normalizar numéricos opcionales con `normalizeOptionalNumber_`.
- Si ya existe fila para `date` → `updateRowById_(SHEETS.NUTRITION, 'date', date, partial)`. Si no → `appendRow_`.
- Devolver el registro guardado.

### 2. `getNutritionDay(params)` — READ (TTL corto, ~300s, depende de "hoy")

**params:** `{ date? }` (default `todayIso_()`)
Devuelve el registro de esa fecha o `null` si no hay.

### 3. `listNutritionHistory(params)` — READ (TTL ~1800s)

**params:** `{ limit? }` (default 60)
Devuelve array de registros ordenado por `date` descendente, con numéricos parseados (`''` → `null`).

### 4. `getWeeklyAdjustment()` — READ (TTL ~600s)

**El corazón del módulo.** Calcula el promedio semanal de peso y devuelve el veredicto de autoajuste.

Lógica:
1. Leer todos los registros de `Nutrition` con `weight` no vacío, ordenados por fecha.
2. Agrupar por semana ISO (lunes a domingo). Para cada semana con ≥3 pesos, calcular el promedio.
3. Tomar las 2 últimas semanas completas con datos suficientes.
4. Calcular `delta = promedioSemanaActual - promedioSemanaAnterior` (en kg, negativo = bajó).
5. Devolver:
```
{
  current_week_avg: number | null,
  prev_week_avg: number | null,
  delta_kg: number | null,           // redondeado a 2 decimales
  weeks_of_data: number,
  verdict: 'sin_datos' | 'bajando_bien' | 'estancado' | 'muy_rapido',
  message: string,                   // texto en español para mostrar
  target_calories: number | null     // sugerencia si aplica (ver reglas)
}
```

**Reglas del veredicto** (target base = 2050 kcal; estos números son los del plan del usuario):
- `< 3` pesos en la semana actual → `verdict: 'sin_datos'`, message pидiendo pesarse 3-4 mañanas.
- `delta` entre -0.5 y -0.3 kg/sem (baja saludable) → `'bajando_bien'`, seguir igual.
- `delta > -0.3` durante 2 semanas seguidas (estancado o subiendo) → `'estancado'`, sugerir bajar ~150 kcal (target_calories = actual - 150).
- `delta < -0.7 kg/sem` (muy rápido, riesgo de perder músculo) → `'muy_rapido'`, sugerir subir ~150 kcal (target_calories = actual + 150).
- Entre -0.7 y -0.5 → aceptable, `'bajando_bien'`.

El "actual" de calorías: si el usuario tiene un target guardado en Script Properties (`nutrition_target_kcal`), usarlo; si no, default 2050. Guardar el target ajustado cuando cambie.

### 5. `getNutritionHomeStats()` — READ (TTL ~600s)

Para mostrar en la pantalla Inicio un resumen rápido:
```
{
  today: { logged: bool, weight, kcal, protein },
  week_avg_weight: number | null,
  streak_days: number,        // días consecutivos con registro hasta hoy
  protein_target: 155,
  kcal_target: number
}
```

---

## Frontend — pantalla nueva "Nutrición"

Agregar una 5ª sección al nav (`screen-nutrition`) siguiendo el patrón visual existente de las otras screens (misma estructura de `.screen`, mismo sistema de estilos, acento naranja `--accent`).

### Layout de la pantalla

**Bloque 1 — Registro de hoy (lo primero, lo más accesible):**
- Card con la fecha de hoy.
- 3 inputs principales, grandes y rápidos: **Peso (kg)**, **Calorías**, **Proteína (g)**.
- Un desplegable "+ más detalle" (colapsado por default) con: grasa, carbos, agua, pasos, notas, y un check "entrené hoy".
- Botón "Guardar día" → llama `saveNutritionDay`. Si ya había registro hoy, precargar los valores (editar en vez de duplicar).
- Feedback visual al guardar (igual que el resto de la app).

**Bloque 2 — Autoajuste semanal (el semáforo):**
- Llama `getWeeklyAdjustment`.
- Muestra: promedio de esta semana vs la anterior, el delta en kg, y una barra/indicador de color según `verdict`:
  - `bajando_bien` → verde, "Vas bien, seguí igual"
  - `estancado` → ámbar, "Estancado — bajá ~150 kcal (nuevo target: X)"
  - `muy_rapido` → rojo, "Muy rápido, sumá ~150 kcal para no perder músculo"
  - `sin_datos` → gris, "Pesate 3-4 mañanas para calcular el ajuste"
- Mostrar el `message` que devuelve el backend.

**Bloque 3 — Histórico de peso:**
- Llama `listNutritionHistory`.
- Gráfico simple de peso en el tiempo (reusar la librería de charts que ya usa la pantalla Progreso, si hay; si no, una tabla simple de últimos 14 días).
- Marcar visualmente la línea de tendencia / promedio semanal.

### Integración en Inicio (opcional pero recomendado)
En la pantalla Inicio, agregar una tarjeta chica con `getNutritionHomeStats`: si no cargó el peso hoy, un recordatorio "Registrá tu peso de hoy" que lleve a la pantalla de nutrición.

---

## Criterios de aceptación

1. Puedo cargar peso + kcal + proteína en <10 segundos desde la pantalla de nutrición.
2. Si cargo dos veces el mismo día, se actualiza (no se duplica).
3. Después de 2 semanas de datos, el semáforo de autoajuste me dice claramente qué hacer con las calorías.
4. El promedio semanal usa solo los pesos de nutrición, no los de las sesiones de gym.
5. Nada del módulo de gym existente se rompe ni cambia de comportamiento.
6. Las lecturas están cacheadas y las escrituras invalidan el cache (patrón existente).

---

## Notas para el implementador (Claude Code)

- Seguí el estilo del código existente: helpers con sufijo `_`, respuestas vía `json_`, funciones API sin sufijo.
- No inventes una tabla nueva: la pestaña `Nutrition` y sus headers ya existen, usalos tal cual.
- Antes de escribir, leé cómo `saveSession` y `editSession` manejan validación y upsert para mantener consistencia de estilo.
- El target de calorías por default es 2050 y el de proteína 155 g — son del plan del usuario, dejalos como constantes configurables arriba del archivo.
