// ============================================================
// SHYM — SCHEMA CANONICO
// ============================================================
// Fuente unica de verdad del modelo de datos. De aca sale el SQL de D1 y
// tambien el mapeo de tipos que usa la capa de lectura.
//
// Regla de oro del port desde Google Sheets: `readAll_` tiene que devolver
// EXACTAMENTE lo que devolvia Sheets, porque la logica de negocio depende de
// eso en cientos de lugares:
//   - celda vacia  -> '' (string vacio), NUNCA null.
//     `calcSetMetrics_` y compania hacen `set.weight === '' ? null : Number(...)`.
//     Con null, `Number(null)` da 0 y una serie sin peso contaria como 0kg.
//   - celda booleana -> true/false nativo.
//     `getTrainPickData` hace `routines.find(r => r.is_active)` sin `isTrue_`,
//     asi que el string 'false' seria truthy y elegiria la rutina equivocada.
//   - celda numerica -> number nativo.
// ============================================================

// Tipos de columna. Definen el SQL y la conversion de vuelta a "forma Sheets".
export const T = {
  TEXT: 'text',    // '' cuando esta vacia
  NUM: 'num',      // number nativo, '' cuando esta vacia
  BOOL: 'bool',    // true/false nativo, '' cuando esta vacia
};

export const SHEETS = {
  ROUTINES: 'Routines',
  DAYS: 'Routine_Days',
  EXERCISES: 'Day_Exercises',
  SESSIONS: 'Sessions',
  SETS: 'Session_Sets',
  GOALS: 'Exercise_Goals',
  NUTRITION: 'Nutrition',
  LIBRARY: 'Exercise_Library',
};

// Nombre logico (el que usa la logica de negocio) -> tabla fisica en D1.
export const TABLE_OF = {
  [SHEETS.ROUTINES]: 'routines',
  [SHEETS.DAYS]: 'routine_days',
  [SHEETS.EXERCISES]: 'day_exercises',
  [SHEETS.SESSIONS]: 'sessions',
  [SHEETS.SETS]: 'session_sets',
  [SHEETS.GOALS]: 'exercise_goals',
  [SHEETS.NUTRITION]: 'nutrition',
  [SHEETS.LIBRARY]: 'exercise_library',
};

// Columnas en orden. El orden importa: replica el orden de columnas del Sheet
// y define el orden de los INSERT.
export const COLUMNS = {
  [SHEETS.ROUTINES]: {
    routine_id: T.TEXT,
    routine_name: T.TEXT,
    created_at: T.TEXT,
    is_active: T.BOOL,
  },
  [SHEETS.DAYS]: {
    day_id: T.TEXT,
    routine_id: T.TEXT,
    day_name: T.TEXT,
    day_order: T.NUM,
    week_days: T.TEXT,
  },
  [SHEETS.EXERCISES]: {
    routine_exercise_id: T.TEXT,
    day_id: T.TEXT,
    exercise_order: T.NUM,
    exercise_name: T.TEXT,
    target_sets: T.NUM,
    target_reps_min: T.NUM,
    target_reps_max: T.NUM,
    suggested_weight: T.NUM,
    technique_note: T.TEXT,
    muscle_group: T.TEXT,
    muscle_distribution: T.TEXT,
  },
  [SHEETS.SESSIONS]: {
    session_id: T.TEXT,
    date: T.TEXT,
    routine_id: T.TEXT,
    day_id: T.TEXT,
    bodyweight: T.NUM,
    notes: T.TEXT,
    created_at: T.TEXT,
    routine_name: T.TEXT,
    day_name: T.TEXT,
  },
  [SHEETS.SETS]: {
    set_id: T.TEXT,
    session_id: T.TEXT,
    routine_exercise_id: T.TEXT,
    exercise_name: T.TEXT,
    set_number: T.NUM,
    weight: T.NUM,
    reps: T.NUM,
    rir: T.NUM,
    note: T.TEXT,
    muscle_group: T.TEXT,
    muscle_distribution: T.TEXT,
  },
  [SHEETS.GOALS]: {
    goal_id: T.TEXT,
    exercise_name: T.TEXT,
    target_weight: T.NUM,
    target_1rm: T.NUM,
    created_at: T.TEXT,
    updated_at: T.TEXT,
  },
  [SHEETS.NUTRITION]: {
    date: T.TEXT,
    weight: T.NUM,
    water: T.NUM,
    kcal: T.NUM,
    protein: T.NUM,
    fat: T.NUM,
    carbs: T.NUM,
    steps: T.NUM,
    notes: T.TEXT,
    trained: T.BOOL,
  },
  [SHEETS.LIBRARY]: {
    exercise_id: T.TEXT,
    exercise_name: T.TEXT,
    target_sets: T.NUM,
    target_reps_min: T.NUM,
    target_reps_max: T.NUM,
    suggested_weight: T.NUM,
    technique_note: T.TEXT,
    muscle_group: T.TEXT,
    muscle_distribution: T.TEXT,
    created_at: T.TEXT,
  },
};

// Compat: la logica de negocio portada sigue usando HEADERS.
export const HEADERS = Object.fromEntries(
  Object.entries(COLUMNS).map(([name, cols]) => [name, Object.keys(cols)])
);

export const SHEET_NAMES = Object.keys(COLUMNS);

// Clave primaria logica de cada tabla, para UPDATE/DELETE por id.
export const PRIMARY_KEY = {
  [SHEETS.ROUTINES]: 'routine_id',
  [SHEETS.DAYS]: 'day_id',
  [SHEETS.EXERCISES]: 'routine_exercise_id',
  [SHEETS.SESSIONS]: 'session_id',
  [SHEETS.SETS]: 'set_id',
  [SHEETS.GOALS]: 'goal_id',
  [SHEETS.NUTRITION]: 'date',
  [SHEETS.LIBRARY]: 'exercise_id',
};

const SQL_TYPE = { [T.TEXT]: 'TEXT', [T.NUM]: 'REAL', [T.BOOL]: 'INTEGER' };

// Genera el DDL. `_seq` preserva el orden de insercion que en Sheets era
// implicito (el orden de las filas); varias vistas dependen de el.
export function buildSchemaSql() {
  const out = [];
  for (const sheetName of SHEET_NAMES) {
    const table = TABLE_OF[sheetName];
    const cols = COLUMNS[sheetName];
    const pk = PRIMARY_KEY[sheetName];
    const lines = ['  _seq INTEGER PRIMARY KEY AUTOINCREMENT'];
    for (const [col, type] of Object.entries(cols)) {
      lines.push(`  ${col} ${SQL_TYPE[type]}`);
    }
    out.push(`CREATE TABLE IF NOT EXISTS ${table} (\n${lines.join(',\n')}\n);`);
    out.push(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_pk ON ${table} (${pk});`);
  }
  // Indices de los filtros calientes.
  out.push('CREATE INDEX IF NOT EXISTS idx_routine_days_routine ON routine_days (routine_id);');
  out.push('CREATE INDEX IF NOT EXISTS idx_day_exercises_day ON day_exercises (day_id);');
  out.push('CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date);');
  out.push('CREATE INDEX IF NOT EXISTS idx_session_sets_session ON session_sets (session_id);');
  out.push('CREATE INDEX IF NOT EXISTS idx_session_sets_exercise ON session_sets (exercise_name);');
  // Reemplaza a PropertiesService.
  out.push('CREATE TABLE IF NOT EXISTS settings (\n  key TEXT PRIMARY KEY,\n  value TEXT\n);');
  return out.join('\n\n') + '\n';
}
