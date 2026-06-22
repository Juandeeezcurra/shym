# Rediseño Shym — Plan completo

> Documento de trabajo. Define qué vamos a construir y por qué.
> Acordado con Juan en conversación (2026-06-21). Estado: **diseño cerrado, esperando arrancar.**

---

## 1. Filosofía: la app tiene que pensar como Juan

Hoy la app **registra** bien pero **no concluye nada**: muestra datos (sobre todo *volumen*) en un idioma que no es el de Juan. El rediseño reorganiza todo alrededor de **cómo Juan piensa su progreso**.

### Modelo mental (confirmado)
- **Doble progresión.** Subir el peso = el gran avance. Cuando subís peso, las reps bajan y *está bien*. El objetivo intermedio es recuperar/subir reps a ese peso nuevo; al llegar al tope de reps, toca subir peso otra vez. Ciclo.
- **Unidad que importa: serie a serie.** Ancla = la mejor serie, pero querés ver "un poco de todo" (cada serie, no solo el total).
- **El volumen NO importa.** Sale del centro de la escena en toda la app.
- **Peso-first.** Subir peso cuenta como mejora aunque bajen reps.

### Reglas de lectura "mejor / igual / peor"
Comparando una serie (o la mejor serie) contra la misma de la sesión anterior:

| Situación | Lectura |
|---|---|
| Subió el peso | ✅ Mejora (avance de ciclo), aunque bajen reps |
| Mismo peso, más reps | ✅ Mejora (camino a la próxima subida) |
| Mismo peso, mismas reps | = Igual |
| Mismo peso, menos reps | ⚠️ Atención |
| Bajó el peso | 🔻 Retroceso |

### Estancamiento (sin etiquetas inventadas)
Nada de umbrales tipo "estás estancado hace N". Solo el **dato crudo**:
> *"Última vez: 82.5 kg × 8 · Hace 5 sesiones que no pasás de 82.5 kg."*

Juan saca la conclusión y decide.

---

## 2. Los tres frentes

### 🏠 A. Home — tablero "¿cómo vengo?"

Rol elegido: **panel de estado** desde donde también arrancás a entrenar. Orden de arriba a abajo:

1. **Racha / constancia** (tira compacta arriba)
   - Días entrenados esta semana + racha activa.
   - **Sin volumen.** Reemplaza la tarjeta de semana actual (que hoy muestra `X kg ▲5%` y grilla coloreada por volumen).

2. **Hoy toca + arrancar**
   - El día que toca, sus ejercicios.
   - En cada ejercicio, el **objetivo a superar** (lo mejor de la última vez).
   - Botón **Entrenar →**.

3. **Cómo venís** (highlights de progreso)
   - **PRs recientes.**
   - Ejercicios **subiendo / trabados** (resumen, link al detalle en Progreso).

4. **Nutrición del día** (secundaria, abajo)
   - Proteína / kcal del día. Se mantiene como está, pero deja de competir por el centro.

```
Shym                         sáb 21 jun

🔥 Racha: 3 días  ·  Esta semana: 3/4
─────────────────────────────────────
HOY TOCA · Push                Entrenar →
  Press banca       objetivo  82.5×8
  Press inclinado   objetivo  30×12
  Elevaciones       objetivo  12×15
─────────────────────────────────────
CÓMO VENÍS
  🏆 PR  Dominadas  +5 kg  (hoy)
  ↑ Subiendo: Press banca, Remo
  = Trabado:  Sentadilla (hace 5)
─────────────────────────────────────
NUTRICIÓN HOY   1.850 / 2.200 kcal
                P 140 g
```

---

### 📈 B. Progreso — reorganizado alrededor del ejercicio

**Se elimina:**
- ❌ Vista **"Cuerpo"** (el dibujo del cuerpo / heatmap). No aportaba.
- ❌ Vista **"Músculos"** centrada en volumen (series efectivas, directas/indirectas, subzonas, barras semanales). Idioma equivocado.
- ❌ El control de 3 pestañas y el dropdown de ejercicio.

**Nueva estructura: Resumen → Detalle.**

#### B.1 Resumen (pantalla de entrada)
Lista de **todos los ejercicios**, agrupados por parte del cuerpo, **grupos en orden alfabético**. Cada **grupo** muestra un estado rollup; cada **ejercicio** su mejor serie + flecha + "hace X" si no sube. Tap en un ejercicio → detalle.

```
Progreso

ESPALDA              2/3 subiendo
  Dominadas        82.5×8   ↑ +2.5 hoy
  Remo con barra   70×10    ↑
  Jalón al pecho   55×12    = hace 4 ses.

PECHO                1/2 subiendo ⚠
  Press banca      82.5×8   ↑ hoy
  Press inclinado  30×12    ↓ -2 reps

PIERNAS              0/1 subiendo ⚠
  Sentadilla       100×6    = hace 5 ses.
```

**Estado de un ejercicio** (la flecha), comparando la mejor serie más reciente contra la anterior:
- **↑ subiendo** = **solo si subió el peso** (decisión de Juan: criterio estricto, peso-first).
- **= igual** = mismo peso. Cuando estás *ganando reps* al mismo peso (mismo peso, más reps), se muestra un matiz "ganando reps" para no confundirlo con estancamiento, pero **no** cuenta como ↑.
- **↓ bajó** = bajó el peso.
- El "hace X ses." cuenta sesiones sin superar el mejor peso.

**Estado de grupo** ("2/3 subiendo"): cuántos ejercicios del grupo subieron de peso. Marca ⚠️ si hay alguno trabado/bajando.

#### B.2 Detalle de ejercicio
Lo que se abre al tocar un ejercicio. Tres bloques:

**1) Encabezado / veredicto factual**
```
Press banca
Mejor serie: 82.5 kg × 8     ↑ +2.5 kg
Hace 5 sesiones que no pasás de 82.5 kg
```

**2) Gráfico — línea de tu mejor serie**
Curva limpia del peso de la mejor serie por sesión, con las reps anotadas sobre cada punto. Toggle de métrica: **Peso / 1RM est. / Reps** (arranca en Peso).
```
  Mejor serie                    ×6
kg                              .o
85|                 ×8   ×9 .-o'
82|            ×8 .o---o'
80|   ×8  .o--'
   |  o--'
   +-----------------------------
    24/5  31/5   7/6   14/6
              [Peso] [1RM] [Reps]
```

**3) Gráfico — grilla serie × sesión**
Filas = número de serie, columnas = fechas. Cada celda = `peso×reps`, con **color por peso** (más oscuro = más pesado). Leés una fila de izquierda a derecha y ves el ciclo de doble progresión. Arranca mostrando **4 sesiones**; scroll horizontal para ver más atrás.
```
  Serie a serie
        24/5  31/5   7/6  14/6
 S1  │ 80×8  80×8  82×8  82×9
 S2  │ 80×7  80×8  82×7  82×8
 S3  │ 77×8  80×7  80×8  80×8
       (celda más oscura = más peso)
```

**4) Sesiones recientes** (lista, tap → detalle de sesión). Se mantiene, pero los chips muestran la diferencia en lenguaje claro (+2.5 kg / +1 rep / =).

---

### 🏋️ C. Entrenar — comparación en vivo

En la pantalla de entrenamiento, cada serie muestra el **objetivo a superar** = lo que hiciste en esa misma serie la última vez. Cuando cargás un valor que lo iguala o supera, la serie se marca (✓ / 🔥).

```
Press banca           PR 82.5×8 ★
Última vez · 14 jun
─────────────────────────────────
 Hoy            Objetivo
1  [82.5] [ 8 ]   80×8   ✓ superado 🔥
2  [80  ] [ 8 ]   80×8   ✓
3  [   ] [   ]    80×7   —
```

El "objetivo" por serie sale de la última sesión de ese ejercicio (ya se carga hoy como "Última vez").

**Además (jugadas grandes adoptadas):**
- **Series pre-cargadas:** cada casillero de hoy arranca con el valor de la última vez como *fantasma* (placeholder). Empezás desde ahí y decidís si igualás o subís. Cero tipeo desde cero.
- **Carga rápida:** botones **+/−** en peso y reps, y **"copiar serie anterior"**, para no escribir todo a mano cada serie.

---

### 🧭 D. Navegación — de 6 a 4

El menú inferior pasa de 6 destinos (Inicio · Entrenar · Nutrición · Progreso · Historial · Rutinas) a **4**:

**Inicio · Entrenar · Progreso · Nutrición**

- **Historial se absorbe dentro de Progreso** (son la misma data vista de otra forma).
- **Rutinas pasa a acceso secundario** desde el Inicio (se edita poco, no merece ícono fijo).

---

## 3. Qué se saca / se baja de jerarquía
- **Fuera:** vista "Cuerpo" (dibujo), vista "Músculos" (volumen), tarjeta de volumen semanal de la Home.
- **Baja:** cualquier mención a *volumen* y *series efectivas* como métrica principal. Si se conserva en algún lado, queda como dato secundario, nunca protagonista.

### Refresh visual: toda la app
Juan eligió **unificar el estilo en toda la app**, no solo en las 3 pantallas que cambian de fondo. Eso suma una pasada de consistencia visual sobre Nutrición, Rutinas, Historial y Home: misma tipografía/espaciados/tarjetas/colores, un solo lenguaje visual. Se hace al final, una vez que la funcionalidad nueva está en pie.

---

## 4. Notas técnicas

### Datos: la mayoría ya existe
- `listExerciseHistory` (Code.gs ~2718) ya devuelve por sesión: `weight_max`, `e1rm_max`, `reps_total`, `volume`, `delta_volume`, `delta_e1rm`, `trend` y las series individuales (`weight`, `reps`, `rir`, `note`). **Alcanza para todo el detalle de ejercicio sin tocar backend.**
- `getHomeStats` (Code.gs ~2077) ya devuelve: `trained_today`, `active_routine`, `last_session`, `week_activity`, `previous_week_summary`, `recent_pr`, `today_day` (con ejercicios). Alcanza para racha, "hoy toca" y PRs.

### Frontend vs. backend (redeploy)
- **Frontend puro (no requiere redeploy de GAS):**
  - Todo el Progreso (Resumen + Detalle + gráficos).
  - Comparación en vivo en Entrenar.
  - Home: racha/constancia, "hoy toca", PRs, reordenamiento de tarjetas.
  - El **Resumen** de Progreso podría necesitar una llamada que liste todos los ejercicios con su última mejor serie; ver si conviene un endpoint nuevo (backend) o componerlo en el front con lo existente.
- **Requiere tocar `Code.gs` + redeploy manual del Web App:**
  - **"Objetivo a superar hoy" en la Home**: extender `getHomeStats` para incluir la mejor serie previa de cada ejercicio del día.
  - (Posible) endpoint de Resumen de Progreso si no se arma cómodo en el front.

> Recordatorio de workflow: después de cualquier cambio en `Code.gs` hay que **redesplegar el GAS a mano**. Por eso conviene agrupar los cambios de backend en una sola tanda.

### Archivos / funciones a tocar (referencia)
- Pantallas Progreso: `index.html` `#screen-progress` (~2316), `renderProgressExerciseData` (~5425), `renderExerciseHistory` (~6511), `renderExerciseProgressChart` (~5588).
- A retirar/reemplazar: `renderMuscleVolume` (~6301), heatmap de cuerpo.
- Home: `renderHomeTodayCard_` (~3674), `renderHomeWeekCard_` (~3736), `renderHomePrCard_` (~3643), `renderHomeLastSession_` (~3807).
- Entrenar: `renderTrainExercises` (~5102), `renderSetRow` (~5157).

---

## 5. Orden de construcción sugerido
1. **Detalle de ejercicio** (corazón de todo: encabezado factual + línea mejor serie + grilla serie×sesión, 4 sesiones). Frontend.
2. **Resumen de Progreso** (lista por grupo alfabético con estados) + **absorber Historial** dentro de Progreso. Frontend.
3. **Entrenar** (objetivo a superar por serie + series pre-cargadas como fantasma + carga rápida +/− y copiar serie anterior). Frontend.
4. **Navegación 6 → 4** (Inicio · Entrenar · Progreso · Nutrición; Rutinas a acceso secundario). Frontend.
5. **Home** (racha, hoy toca, PRs, reorden). Frontend.
6. **Backend + redeploy**: "objetivo a superar hoy" en Home (y endpoint de Resumen si hace falta).
7. **Refresh visual unificado** sobre toda la app (Nutrición, Rutinas, Historial incluidas).

---

## 6. Decisiones cerradas
- **Orden de grupos en el Resumen:** alfabético.
- **Sesiones visibles en la grilla serie×sesión:** 4 (scroll para ver más atrás).
- **Qué cuenta como "subiendo" (↑):** solo si subió el peso (estricto). "Mismo peso, más reps" se muestra como matiz "ganando reps", no como ↑.
- **Alcance del refresh visual:** toda la app.
- **Jugadas grandes adoptadas:** nav 6→4, series pre-cargadas (fantasma), carga rápida +/− y copiar serie anterior.
- **Descartado:** campo de esfuerzo opcional (fácil/justo/al fallo).
