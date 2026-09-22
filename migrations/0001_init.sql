-- Shym: schema inicial. Generado desde src/schema.js

CREATE TABLE IF NOT EXISTS routines (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id TEXT,
  routine_name TEXT,
  created_at TEXT,
  is_active INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_routines_pk ON routines (routine_id);

CREATE TABLE IF NOT EXISTS routine_days (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id TEXT,
  routine_id TEXT,
  day_name TEXT,
  day_order REAL,
  week_days TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_routine_days_pk ON routine_days (day_id);

CREATE TABLE IF NOT EXISTS day_exercises (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_exercise_id TEXT,
  day_id TEXT,
  exercise_order REAL,
  exercise_name TEXT,
  target_sets REAL,
  target_reps_min REAL,
  target_reps_max REAL,
  suggested_weight REAL,
  technique_note TEXT,
  muscle_group TEXT,
  muscle_distribution TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_day_exercises_pk ON day_exercises (routine_exercise_id);

CREATE TABLE IF NOT EXISTS sessions (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  date TEXT,
  routine_id TEXT,
  day_id TEXT,
  bodyweight REAL,
  notes TEXT,
  created_at TEXT,
  routine_name TEXT,
  day_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_pk ON sessions (session_id);

CREATE TABLE IF NOT EXISTS session_sets (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id TEXT,
  session_id TEXT,
  routine_exercise_id TEXT,
  exercise_name TEXT,
  set_number REAL,
  weight REAL,
  reps REAL,
  rir REAL,
  note TEXT,
  muscle_group TEXT,
  muscle_distribution TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_sets_pk ON session_sets (set_id);

CREATE TABLE IF NOT EXISTS exercise_goals (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  exercise_name TEXT,
  target_weight REAL,
  target_1rm REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_goals_pk ON exercise_goals (goal_id);

CREATE TABLE IF NOT EXISTS nutrition (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  weight REAL,
  water REAL,
  kcal REAL,
  protein REAL,
  fat REAL,
  carbs REAL,
  steps REAL,
  notes TEXT,
  trained INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_pk ON nutrition (date);

CREATE TABLE IF NOT EXISTS exercise_library (
  _seq INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id TEXT,
  exercise_name TEXT,
  target_sets REAL,
  target_reps_min REAL,
  target_reps_max REAL,
  suggested_weight REAL,
  technique_note TEXT,
  muscle_group TEXT,
  muscle_distribution TEXT,
  created_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_library_pk ON exercise_library (exercise_id);

CREATE INDEX IF NOT EXISTS idx_routine_days_routine ON routine_days (routine_id);

CREATE INDEX IF NOT EXISTS idx_day_exercises_day ON day_exercises (day_id);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date);

CREATE INDEX IF NOT EXISTS idx_session_sets_session ON session_sets (session_id);

CREATE INDEX IF NOT EXISTS idx_session_sets_exercise ON session_sets (exercise_name);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
