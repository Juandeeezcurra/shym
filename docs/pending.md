# Pending — Gym Tracker

Última actualización: 2026-05-02.

---

## Por hacer — UI/UX

1. ✅ **Borde superior raro (screen-train-pick):** ajustado padding/safe-area del header de selección de entrenamiento.

2. ✅ **Campo de fecha se sale de los límites:** corregido con `min-width: 0`, `max-width: 100%`, `overflow: hidden` en la card y `appearance: none` en el input de fecha.

3. ✅ **Bottom nav — nueva estructura y botón central:** reemplazada por 5 ítems:
   - Inicio · Rutinas · **⬤ mancuerna** (CTA central) · Progreso · Historial
   - El botón central usa SVG inline de mancuerna y abre `screen-train-pick`.
   - Agregada pantalla `screen-history` y endpoint `listRecentSessions({ limit })`.

4. ✅ **Quitar "5.5k kg de volumen semanal" de toda la app:**
   - Eliminado ese stat del Home.
   - En Progreso, el header del ejercicio ahora muestra **Último máx.** usando `weight_max` de la sesión más reciente.

5. 🟡 **Rediseño de tarjetas de stats del Home (pendiente de discutir):** parcialmente resuelto. Ya no hay 3 tarjetas ni volumen semanal; quedan 2 tarjetas (`ejercicios en progreso`, `marcas mejoradas`). **A definir qué métricas finales van.**

6. ✅ **Autocomplete de nombres de ejercicio:** implementado con `datalist` usando `listAllExerciseNames()`.

7. ✅ **Inputs numéricos en ejercicios:** `target_sets`, reps mín y reps máx ahora tienen `type="number"`, `inputmode="numeric"` y `pattern="[0-9]*"`.

8. **Grupos musculares — feature grande, múltiples etapas:**

   **8a. Etiqueta de músculo en ejercicios (base de todo lo demás):**
   - Agregar campo `muscle_group` a `Day_Exercises` (y opcionalmente a `Session_Sets` para historial).
   - Opciones fijas: `pecho` · `espalda` · `hombros` · `bícep` · `trícep` · `core` · `piernas`.
   - El modal de ejercicio incluye un selector de grupo muscular (chips o select).
   - Backend: agregar `muscle_group` a `HEADERS[SHEETS.EXERCISES]` y a `addExercise` / `updateExercise`. Requiere `setup()` para agregar la columna a la sheet existente, o migración manual.

   **8b. Orden por músculo en pantallas de rutina y progreso:**
   - En `screen-day-detail`: opción de ver ejercicios agrupados por músculo además del orden actual.
   - En `screen-progress`: selector de músculo para filtrar el historial (en lugar de solo por nombre de ejercicio).

   **8c. Heatmap corporal en Progreso (exploratoria):**
   - SVG de cuerpo humano (frontal + dorsal) con zonas clicables por grupo muscular.
   - Color/intensidad según volumen o frecuencia de entrenamiento de cada grupo en los últimos 7/14/30 días.
   - Al tocar una zona, filtra el historial a ese grupo.
   - Ideas todavía abiertas: qué métrica pinta el heatmap (volumen, frecuencia, progreso relativo), si mostrar solo frontal o también dorsal, granularidad (¿separar bícep/trícep o solo "brazo"?).
   - **No implementar hasta definir el diseño visual y las métricas.**

9. ✅ **PRs automáticos — récords personales:**
   - Al guardar/editar una sesión, cada ejercicio se compara contra su máximo histórico previo de peso (`weight_max`) y de 1RM estimado.
   - El summary muestra badge cuando hay `Nuevo PR peso`, `Nuevo PR 1RM` o ambos.
   - No requiere schema nuevo; se calcula escaneando `Session_Sets` y excluyendo la sesión actual.

10. ✅ **1RM estimado (fórmula de Epley):**
    - Para cada set: `1RM = peso × (1 + reps / 30)`. Se toma el máximo de la sesión.
    - Se muestra en el historial de ejercicio (`screen-progress`) como "1RM est. X kg".
    - También aparece en el summary por ejercicio.
    - No requiere cambios de schema; se calcula en backend sobre los sets existentes.

11. ✅ **Calendario de sesiones:**
    - Agregada vista tipo "GitHub contributions" en `screen-history`.
    - Grilla de últimas 13 semanas, cada celda = un día, intensidad según sesiones/volumen.
    - Al tocar una celda con 1 sesión, abre detalle. Si hay varias, filtra el historial a ese día.
    - Backend: `listSessionDates({ days })` devuelve fechas, cantidad de sesiones, volumen total y `session_ids`.
    - Base completa; a futuro se puede extender a 3-6 meses con navegación por rango.

12. ✅ **Evolución del peso corporal:**
    - Agregada vista `Peso corporal` dentro de `screen-progress`.
    - Gráfico de línea SVG con el `bodyweight` registrado en cada sesión.
    - Backend: `listBodyweightHistory({ limit })` devuelve `date`, `bodyweight` y `session_id`.
    - Muestra último peso, cambio vs anterior, cambio total y registros recientes clickeables.
    - Toggle kg/lb respetado.

13. **Volumen por grupo muscular a lo largo del tiempo:**
    - Complementa el heatmap corporal (ítem 8c).
    - Gráfico de barras apiladas por semana, desglosado por `muscle_group`.
    - Permite ver si estás descuidando algún grupo o sobreentrenando otro.
    - Depende de que 8a (campo `muscle_group` en ejercicios) esté implementado primero.
    - Backend: agregar filtro por `muscle_group` en `getHomeStats` o nuevo endpoint `getVolumeByMuscle({ weeks })`.

14. ✅ **Duplicar rutina:**
    - Clona una rutina existente con todos sus días y ejercicios, asignándole un nombre nuevo (ej: "Push Pull Legs (copia)").
    - Backend: `duplicateRoutine({ routine_id, new_name })` crea nuevos IDs para rutina, días y ejercicios copiando todos los campos. No copia sesiones ni historial.
    - Frontend: botón "Duplicar rutina" en el detalle de rutina.

15. **Calendario semanal — asignar días de la semana a la rutina:**
    - En cada día de la rutina, opción de asignar uno o más días de la semana (lunes, martes… domingo).
    - En el Home, mostrar "Hoy te toca: [nombre del día]" si el día actual tiene un día asignado en la rutina activa.
    - Schema: agregar columna `week_days` a `Routine_Days` (ej: `"1,3"` para lunes y miércoles, o JSON array).
    - Frontend: selector de días en el detalle de día, chip por día de la semana.

16. **Goals por ejercicio:**
    - Setear un objetivo de peso o 1RM estimado para un ejercicio ("quiero hacer 100 kg en press banca").
    - En el historial de ese ejercicio, mostrar barra de progreso hacia la meta y el % alcanzado.
    - Schema: tabla nueva `Exercise_Goals` con `goal_id, exercise_name, target_weight, target_1rm, created_at` — o columna extra en `Day_Exercises`.
    - Backend: `setExerciseGoal({ exercise_name, target_weight, target_1rm })` y `getExerciseGoal({ exercise_name })`.

17. **Duración de sesión:**
    - Registrar `started_at` (timestamp) al entrar a la pantalla de train.
    - Al guardar la sesión, calcular duración y mandarla junto con los demás datos.
    - Backend: agregar columna `duration_minutes` a `Sessions`.
    - Mostrar duración en el summary post-sesión y en el detalle de sesión.
    - `started_at` se guarda en el draft de localStorage para sobrevivir recargas.

18. **Streak semanal:**
    - Contador de semanas consecutivas en que se entrenó al menos N días (configurable, default 3).
    - Mostrado en el Home con número prominente y un label ("4 semanas seguidas").
    - Backend: `getStreakStats()` — recorre sesiones hacia atrás agrupadas por semana, cuenta racha continua.
    - Si la semana actual todavía no llega al mínimo, mostrar cuántas sesiones faltan para mantener la racha.

19. **Resumen semanal en el Home:**
    - Card en el Home que muestra el snapshot de la semana anterior: sesiones, volumen total, PRs conseguidos.
    - Aparece los lunes (o siempre, mostrando "semana pasada").
    - Backend: reusar lógica de `getHomeStats` con rango de fechas de la semana previa, más contar PRs de esa semana.
    - Diseño: card colapsable o fija debajo de las stats actuales.

---

## Decisiones abiertas

1. **PWA / Offline:** `manifest.json` + service worker para instalar desde Safari y funcionar sin señal. Idea guardada para el futuro.

2. **Backup / export:** el Sheet ya es backup natural. Botón "Exportar JSON" si se quiere migrar a otra herramienta. Idea guardada para el futuro.

---

## Riesgos operativos

- **Apps Script timeout:** si la sheet tiene >10k filas, `readAll_` lee todo. Para MVP no es problema; a futuro paginar o usar `getRangeByName`.
- **Concurrencia:** dos pestañas simultáneas pueden generar IDs duplicados en teoría (UUID minimiza el riesgo). Single-user, riesgo bajo.
- **Cache del navegador:** GitHub Pages cachea agresivamente. Si el usuario no ve cambios tras el push: hard refresh (`Cmd+Shift+R`). En iPhone Safari: Settings → Safari → Clear History.
- **Apps Script deploy:** si se olvida hacer "New version" después de pegar `Code.gs` nuevo, el backend sigue corriendo el código viejo.
