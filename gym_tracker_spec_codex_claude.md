# Gym Tracker App — Spec para continuar con Codex / Claude

## Objetivo

Construir una app web mobile-first para trackear rendimiento en el gimnasio usando:

- Frontend: HTML, CSS y JavaScript
- Backend: Google Apps Script
- Base de datos: Google Sheets

La app no debe sentirse como un spreadsheet. Debe sentirse como una app fitness premium: rápida, clara, estética y útil durante el entrenamiento.

El objetivo principal es doble:

1. Registrar entrenamientos más rápido que en Google Sheets.
2. Comparar progreso contra sesiones pasadas para tomar mejores decisiones.

---

## Dirección visual

Estilo acordado:

- Dark mode premium
- Mobile-first
- Sin tablas visibles
- Cards grandes
- Inputs simples
- Botones claros
- Números visibles
- Navegación inferior fija
- Acento rojo/naranja fluor tipo Nike

Paleta actual:

```css
:root {
  --bg: #07090b;
  --card: #111519;
  --card-soft: #171c21;
  --border: #252c33;
  --text: #f4f7f5;
  --muted: #8f9aa3;
  --muted-2: #66717a;
  --accent: #ff5a2a;
  --accent-soft: rgba(255, 90, 42, 0.14);
  --good: #49e278;
  --warn: #ffd166;
  --bad: #ff6b6b;
}
```

Notas de diseño:

- El diseño debe ser usable con una mano en el gimnasio.
- Evitar pantallas con demasiada densidad.
- Evitar sensación de formulario largo.
- La pantalla de entrenamiento puede necesitar acordeones o “ejercicio activo” si hay muchos ejercicios.

---

## Concepto de producto

La app se organiza así:

```text
Rutinas → Días → Ejercicios → Series
```

Ejemplo:

```text
Rutina: Hipertrofia 2026
Día: Push 1
Ejercicio: Press plano
Serie 1: 70 kg x 6
Serie 2: 70 kg x 6
Serie 3: 70 kg x 5
Serie 4: 70 kg x 5
```

El usuario quiere poder:

- Crear rutinas desde la app.
- Definir días dentro de cada rutina.
- Cargar ejercicios dentro de cada día.
- Registrar sesiones entrenamiento por entrenamiento.
- Guardar fecha editable antes de cada sesión.
- Ver lo que hizo la última vez como referencia.
- Guardar sesiones viejas para comparar progreso.
- Comparar por ejercicio, serie, día/rutina y sesión, aunque la comparación avanzada puede quedar para versiones posteriores.

---

## Pantallas principales

### 1. Home

Debe abrir con una Home y mini dashboard.

Contenido:

- Fecha de hoy
- Botón principal: `Empezar entrenamiento`
- Última sesión
- Mini dashboard

Ejemplo de cards:

```text
Sesiones esta semana: 3
Volumen semanal: 24.300 kg
Ejercicios en progreso: 5
Marcas mejoradas: 2
```

La Home no debe tener demasiada información. Es un resumen rápido.

---

### 2. Rutinas

Módulo para crear y editar rutinas.

Estructura deseada:

```text
Rutina
  Día
    Ejercicio
      series objetivo
      reps objetivo
      carga sugerida inicial
      nota técnica opcional
```

Funcionalidad mínima:

- Crear rutina
- Ver rutinas existentes
- Entrar a una rutina
- Crear días
- Crear ejercicios dentro de un día
- Editar ejercicios
- Eliminar ejercicios o días eventualmente

No hace falta un módulo separado de “Ejercicios” al principio. Los ejercicios pueden vivir dentro de cada día de rutina.

---

### 3. Entrenar

Flujo acordado:

```text
Entrenar → Fecha → Elegir rutina → Elegir día → Cargar ejercicios → Guardar sesión → Resumen final
```

La fecha debe venir cargada automáticamente con hoy, pero debe ser editable para cargar sesiones viejas.

Al elegir rutina, aparecen los días disponibles como cards/botones:

```text
Push 1
Pull 1
Push 2
Pull 2
```

Al elegir día, aparecen los ejercicios definidos para ese día.

Cada ejercicio debe mostrar:

```text
Press plano
Objetivo: 4 series · 5-6 reps
Carga sugerida: 70 kg

Última vez:
70 × 6 | 70 × 6 | 70 × 5 | 70 × 5

Hoy:
Serie 1: [kg] [reps] [RIR]
Serie 2: [kg] [reps] [RIR]
Serie 3: [kg] [reps] [RIR]
Serie 4: [kg] [reps] [RIR]
```

Campos por serie:

- peso
- reps
- RIR opcional

Campo opcional por ejercicio:

- nota general del ejercicio

No incluir tiempo de descanso.

---

### 4. Resumen final

Después de guardar una sesión, la app debe mostrar un resumen.

Comparación inicial recomendada:

- Comparar contra la última sesión equivalente del mismo día de rutina.
- Ejemplo: Push 1 de hoy vs Push 1 anterior.

Mostrar por ejercicio:

```text
Press plano
Última vez: 70x6, 70x6, 70x5, 70x5
Hoy: 70x6, 70x6, 70x6, 70x5
Resultado: mejoró
Sugerencia: repetir 70 kg hasta cerrar 4x6
```

Estados posibles:

- Mejoró
- Igual
- Bajó
- Sin datos previos

La sugerencia debe ser simple, basada en reglas.

---

### 5. Progreso

Pantalla de análisis con filtros, no un dashboard gigante.

Filtros deseados:

- Rutina
- Día
- Ejercicio
- Fecha desde / hasta

Vistas posibles:

- Última vez
- Histórico
- Evolución de peso máximo
- Evolución de reps totales
- Evolución de volumen
- Historial serie por serie

Para MVP, hacer solo:

- Selector de ejercicio
- Historial de últimas sesiones para ese ejercicio
- Indicador simple de tendencia

---

## Regla importante de UX

No intentar mostrar toda la comparación en todas partes.

Separación acordada:

```text
Durante entrenamiento = referencia rápida de la última vez
Después de guardar = resumen simple
Progreso = análisis con filtros
```

---

## Modelo de datos recomendado en Google Sheets

Aunque visualmente la app use Rutinas → Días → Ejercicios → Series, la base debe estar normalizada.

### Sheet: Routines

| routine_id | routine_name | created_at | is_active |
|---|---|---|---|
| routine_001 | Hipertrofia 2026 | 2026-04-30 | TRUE |

---

### Sheet: Routine_Days

| day_id | routine_id | day_name | day_order |
|---|---|---|---|
| day_001 | routine_001 | Push 1 | 1 |
| day_002 | routine_001 | Pull 1 | 2 |

---

### Sheet: Day_Exercises

| routine_exercise_id | day_id | exercise_order | exercise_name | target_sets | target_reps_min | target_reps_max | suggested_weight | technique_note |
|---|---|---:|---|---:|---:|---:|---:|---|
| rex_001 | day_001 | 1 | Press plano | 4 | 5 | 6 | 70 | Bajar controlado |
| rex_002 | day_001 | 2 | Press inclinado mancuernas | 3 | 8 | 10 | 22 | Rango completo |

Notas:

- No usar una tabla separada de ejercicios todavía.
- El nombre del ejercicio se guarda directamente en `Day_Exercises`.
- Más adelante se puede normalizar si hace falta.

---

### Sheet: Sessions

| session_id | date | routine_id | day_id | bodyweight | notes | created_at |
|---|---|---|---|---:|---|---|
| sess_001 | 2026-04-30 | routine_001 | day_001 | 78.5 | Buena energía | 2026-04-30T12:00:00Z |

---

### Sheet: Session_Sets

| set_id | session_id | routine_exercise_id | exercise_name | set_number | weight | reps | rir | note |
|---|---|---|---|---:|---:|---:|---:|---|
| set_001 | sess_001 | rex_001 | Press plano | 1 | 70 | 6 | 2 | |
| set_002 | sess_001 | rex_001 | Press plano | 2 | 70 | 6 | 1 | |

Notas:

- Guardar `exercise_name` duplicado en `Session_Sets` es aceptable para preservar historial aunque luego se edite el nombre del ejercicio en la rutina.
- `routine_exercise_id` permite comparar contra el mismo ejercicio dentro del mismo día.
- Para comparar por nombre de ejercicio global, usar `exercise_name`.

---

## Comparaciones deseadas

### Última vez en entrenamiento

Cuando se carga un día, para cada `routine_exercise_id` buscar la última sesión anterior que tenga ese mismo ejercicio.

Mostrar series ordenadas por `set_number`.

---

### Resumen post-sesión

Comparar el ejercicio actual contra la última sesión previa del mismo `routine_exercise_id`.

Métricas simples:

```text
volumen = suma(weight * reps)
reps_totales = suma(reps)
peso_max = max(weight)
mejor_set = max(weight * (1 + reps / 30)) opcional
```

Regla básica:

```text
Si volumen actual > volumen anterior y peso máximo >= peso máximo anterior → Mejoró
Si volumen similar y peso máximo similar → Igual
Si volumen actual < volumen anterior de forma relevante → Bajó
Si no hay sesión anterior → Sin datos previos
```

---

## Reglas simples de sugerencia

Para un ejercicio con rango objetivo:

Ejemplo:

```text
4 series · 5-6 reps
```

Regla:

```text
Si completó todas las series en el máximo del rango:
  sugerir subir peso la próxima vez.

Si quedó dentro del rango pero no cerró todas al máximo:
  sugerir mantener peso.

Si alguna serie quedó por debajo del mínimo:
  sugerir repetir o bajar según magnitud.
```

Ejemplo:

```text
Objetivo: 4x5-6
Hoy: 70x6, 70x6, 70x6, 70x6
Sugerencia: subir carga.

Hoy: 70x6, 70x6, 70x5, 70x5
Sugerencia: mantener 70 kg hasta cerrar 4x6.

Hoy: 70x6, 70x5, 70x4, 70x3
Sugerencia: repetir o bajar; revisar fatiga/técnica.
```

---

## Estado actual del prototipo

Ya existe un mockup HTML estático con:

- Home
- Rutinas
- Entrenar
- Resumen
- Progreso
- Navegación inferior
- Dark mode
- Acento `#ff5a2a`

Datos actuales son ficticios. Hay que conectarlo a Google Sheets con Apps Script.

Botones no funcionales todavía:

- `+ Nueva` en Rutinas
- Crear días
- Crear ejercicios
- Guardar sesión real
- Cargar datos reales
- Ver progreso real

---

## Próximo paso recomendado

No empezar por análisis avanzado.

Orden sugerido de implementación:

1. Conectar Home a datos mockeados desde Apps Script.
2. Implementar creación de rutina.
3. Implementar creación de día dentro de rutina.
4. Implementar creación de ejercicio dentro de día.
5. Implementar flujo Entrenar:
   - elegir fecha
   - elegir rutina
   - elegir día
   - cargar ejercicios
   - precargar última vez
   - guardar sesión
6. Implementar resumen post-sesión simple.
7. Implementar progreso por ejercicio.

---

## Criterio de éxito del MVP

La app es exitosa si:

- Se puede usar desde el celular durante el entrenamiento sin fricción.
- Registrar una sesión es más cómodo que hacerlo en Sheets.
- La app muestra la última vez de cada ejercicio como referencia.
- Las sesiones quedan guardadas con fecha y no se pisan.
- Después de guardar, muestra un resumen simple útil.
- El diseño se siente como app, no como formulario.

