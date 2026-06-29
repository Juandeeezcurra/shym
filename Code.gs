// ============================================================
// GYM TRACKER — GOOGLE APPS SCRIPT
// ============================================================
// Setup:
//   1. Crea un Google Sheets vacio.
//   2. Extensions > Apps Script. Pega solo Code.gs.
//   3. Corre setup() una vez (boton Run).
//   4. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone.
//   5. Abri la app en GitHub Pages y pega la URL /exec del deploy.
// ============================================================
// Single-user. Pesos guardados siempre en kg (toggle kg/lb es solo display).
// ============================================================

const SHEETS = {
  ROUTINES: 'Routines',
  DAYS: 'Routine_Days',
  EXERCISES: 'Day_Exercises',
  SESSIONS: 'Sessions',
  SETS: 'Session_Sets',
  GOALS: 'Exercise_Goals',
  NUTRITION: 'Nutrition',
};

const HEADERS = {
  [SHEETS.ROUTINES]: [
    'routine_id', 'routine_name', 'created_at', 'is_active'
  ],
  [SHEETS.DAYS]: [
    'day_id', 'routine_id', 'day_name', 'day_order', 'week_days'
  ],
  [SHEETS.EXERCISES]: [
    'routine_exercise_id', 'day_id', 'exercise_order', 'exercise_name',
    'target_sets', 'target_reps_min', 'target_reps_max',
    'suggested_weight', 'technique_note', 'muscle_group', 'muscle_distribution'
  ],
  [SHEETS.SESSIONS]: [
    'session_id', 'date', 'routine_id', 'day_id',
    'bodyweight', 'notes', 'created_at', 'routine_name', 'day_name'
  ],
  [SHEETS.SETS]: [
    'set_id', 'session_id', 'routine_exercise_id', 'exercise_name',
    'set_number', 'weight', 'reps', 'rir', 'note', 'muscle_group', 'muscle_distribution'
  ],
  [SHEETS.GOALS]: [
    'goal_id', 'exercise_name', 'target_weight', 'target_1rm', 'created_at', 'updated_at'
  ],
  [SHEETS.NUTRITION]: [
    'date', 'weight', 'water', 'kcal', 'protein', 'fat', 'carbs', 'steps', 'notes', 'trained'
  ],
};

let READ_CACHE_ = {};

const READ_API_CACHE_SECONDS_ = {
  ping: 20,
  listRoutines: 120,
  getRoutine: 300,
  getActiveRoutine: 120,
  getTrainPickData: 120,
  getLastSessionForDay: 120,
  getSession: 120,
  getHomeStats: 60,
  getWeekActivity: 60,
  getHistoryData: 60,
  listRecentSessions: 60,
  listSessionDates: 60,
  listBodyweightHistory: 60,
  listAllExerciseNames: 300,
  getProgressExerciseData: 60,
  getProgressSummary: 60,
  listExerciseHistory: 60,
  listMuscleGroupHistory: 60,
  getVolumeByMuscle: 60,
  getMuscleHeatmap: 60,
  getExerciseGoal: 60,
};

const WRITE_API_ = {
  createRoutine: true,
  renameRoutine: true,
  duplicateRoutine: true,
  setActiveRoutine: true,
  deleteRoutine: true,
  addDay: true,
  renameDay: true,
  updateDayWeekDays: true,
  deleteDay: true,
  reorderDay: true,
  addExercise: true,
  updateExercise: true,
  deleteExercise: true,
  reorderExercise: true,
  saveSession: true,
  editSession: true,
  deleteSession: true,
  setExerciseGoal: true,
  migrateHistoricalSnapshots: true,
};

// ============================================================
// WEB/API ENTRY
// ============================================================

function doGet() {
  return json_({
    ok: true,
    app: 'Gym Tracker API',
    message: 'Backend activo. Abrí la app desde GitHub Pages y configurá esta URL /exec.',
    time: nowIso_(),
  });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    const fn = (body.fn || '').toString();
    const args = Array.isArray(body.args) ? body.args : [];
    const api = getApi_();
    if (!api[fn]) throw new Error('Funcion API no permitida: ' + fn);
    if (READ_API_CACHE_SECONDS_[fn]) {
      const cacheKey = apiCacheKey_(fn, args);
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) return json_({ ok: true, result: JSON.parse(cached), cached: true });
      const result = api[fn].apply(null, args);
      putApiCache_(cacheKey, result, READ_API_CACHE_SECONDS_[fn]);
      return json_({ ok: true, result });
    }
    const result = api[fn].apply(null, args);
    if (WRITE_API_[fn]) bumpApiCacheVersion_();
    return json_({ ok: true, result });
  } catch (err) {
    return json_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
}

function apiCacheKey_(fn, args) {
  const version = PropertiesService.getScriptProperties().getProperty('api_cache_version') || '1';
  const raw = version + '|' + fn + '|' + JSON.stringify(args || []);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return 'api:' + Utilities.base64EncodeWebSafe(digest).slice(0, 42);
}

function putApiCache_(key, result, seconds) {
  try {
    const payload = JSON.stringify(result);
    if (payload.length < 90000) {
      CacheService.getScriptCache().put(key, payload, seconds);
    }
  } catch (err) {
    // CacheService es oportunista: si falla, la API sigue funcionando sin cache.
  }
}

function bumpApiCacheVersion_() {
  try {
    PropertiesService.getScriptProperties().setProperty('api_cache_version', nowIso_() + ':' + Utilities.getUuid());
  } catch (err) {
    // No bloquea escrituras si PropertiesService no esta disponible temporalmente.
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getApi_() {
  return {
    ping,
    listRoutines,
    createRoutine,
    renameRoutine,
    duplicateRoutine,
    setActiveRoutine,
    deleteRoutine,
    getRoutine,
    addDay,
    renameDay,
    updateDayWeekDays,
    deleteDay,
    reorderDay,
    addExercise,
    updateExercise,
    deleteExercise,
    reorderExercise,
    getActiveRoutine,
    getTrainPickData,
    getLastSessionForDay,
    saveSession,
    getSession,
    editSession,
    deleteSession,
    getHomeStats,
    getWeekActivity,
    getHistoryData,
    listRecentSessions,
    listSessionDates,
    listBodyweightHistory,
    listAllExerciseNames,
    getProgressExerciseData,
    getProgressSummary,
    listExerciseHistory,
    listMuscleGroupHistory,
    getVolumeByMuscle,
    getMuscleHeatmap,
    getExerciseGoal,
    setExerciseGoal,
    migrateHistoricalSnapshots,
  };
}

// ============================================================
// SETUP — corre esto una vez despues de pegar el script
// ============================================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Bind este script a un Google Sheets primero.');

  Object.keys(HEADERS).forEach(name => ensureSheet_(name));

  // Borra la sheet por defecto si esta vacia y existe
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  const migration = migrateHistoricalSnapshots_();
  return 'Sheets listas: ' + Object.values(SHEETS).join(', ') + '. Migracion: ' + JSON.stringify(migration);
}

function migrateHistoricalSnapshots() {
  Object.keys(HEADERS).forEach(name => ensureSheet_(name));
  return migrateHistoricalSnapshots_();
}

function migrateHistoricalSnapshots_() {
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const exercises = readAll_(SHEETS.EXERCISES);
  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const exerciseMeta = buildExerciseMuscleMeta_(exercises);
  const routinesById = {};
  const daysById = {};

  routines.forEach(routine => {
    routinesById[routine.routine_id] = routine;
  });
  days.forEach(day => {
    daysById[day.day_id] = day;
  });

  const result = {
    sessions_checked: sessions.length,
    sessions_updated: 0,
    sessions_unresolved: 0,
    sets_checked: sets.length,
    sets_updated: 0,
    sets_unresolved: 0,
    exercise_distributions_updated: 0,
    set_distributions_updated: 0,
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sessions.forEach(session => {
      if (!session.session_id) return;
      const routine = routinesById[session.routine_id] || {};
      const day = daysById[session.day_id] || {};
      const routineName = (session.routine_name || routine.routine_name || '').toString().trim();
      const dayName = (session.day_name || day.day_name || '').toString().trim();
      const partial = {};

      if (!session.routine_name && routineName) partial.routine_name = routineName;
      if (!session.day_name && dayName) partial.day_name = dayName;
      if (Object.keys(partial).length) {
        updateRowById_(SHEETS.SESSIONS, 'session_id', session.session_id, partial);
        result.sessions_updated++;
      }
      if ((!session.routine_name && !routineName) || (!session.day_name && !dayName)) {
        result.sessions_unresolved++;
      }
    });

    exercises.forEach(ex => {
      if (!ex.routine_exercise_id) return;
      const muscleGroup = resolveExerciseMuscleGroup_(ex, exerciseMeta);
      const muscleDistribution = resolveExerciseMuscleDistribution_(ex, exerciseMeta);
      const partial = {};
      if (muscleGroup && safeNormalizeMuscleGroup_(ex.muscle_group) !== muscleGroup) {
        partial.muscle_group = muscleGroup;
      }
      if (!Object.keys(parseMuscleDistribution_(ex.muscle_distribution)).length && Object.keys(muscleDistribution).length) {
        partial.muscle_distribution = JSON.stringify(muscleDistribution);
      }
      if (Object.keys(partial).length) {
        updateRowById_(SHEETS.EXERCISES, 'routine_exercise_id', ex.routine_exercise_id, partial);
        result.exercise_distributions_updated++;
      }
    });

    sets.forEach(set => {
      if (!set.set_id) {
        result.sets_unresolved++;
        return;
      }
      const existingGroup = safeNormalizeMuscleGroup_(set.muscle_group);
      const muscleGroup = resolveSetMuscleGroup_(set, exerciseMeta);
      const muscleDistribution = resolveSetMuscleDistribution_(set, exerciseMeta);
      const partial = {};
      if (!existingGroup && muscleGroup) {
        partial.muscle_group = muscleGroup;
      }
      if (!Object.keys(parseMuscleDistribution_(set.muscle_distribution)).length && Object.keys(muscleDistribution).length) {
        partial.muscle_distribution = JSON.stringify(muscleDistribution);
      }
      if (Object.keys(partial).length) {
        updateRowById_(SHEETS.SETS, 'set_id', set.set_id, partial);
        result.sets_updated++;
        if (partial.muscle_distribution) result.set_distributions_updated++;
      }
      if (!muscleGroup) result.sets_unresolved++;
    });
  } finally {
    lock.releaseLock();
  }

  return result;
}

// ============================================================
// HELPERS GENERICOS
// ============================================================

function getSheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" no existe. Corre setup() primero.');
  return sh;
}

function ensureSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Bind este script a un Google Sheets primero.');
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const headers = HEADERS[name];
  if (!headers) throw new Error('Headers no definidos para ' + name);
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#111519')
    .setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function sheetExists_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return !!(ss && ss.getSheetByName(name));
}

function readAll_(name) {
  if (READ_CACHE_[name]) {
    return READ_CACHE_[name].map(row => Object.assign({}, row));
  }
  const sh = getSheet_(name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = values
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  READ_CACHE_[name] = rows;
  return rows.map(row => Object.assign({}, row));
}

function invalidateReadCache_(name) {
  if (name) delete READ_CACHE_[name];
  else READ_CACHE_ = {};
}

function appendRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  const row = headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '');
  sh.appendRow(row);
  invalidateReadCache_(name);
  return obj;
}

function appendRows_(name, objects) {
  const items = objects || [];
  if (!items.length) return [];
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  const rows = items.map(obj => headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : ''));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  invalidateReadCache_(name);
  return items;
}

function findRowIndex_(sh, name, idCol, idValue) {
  const headers = HEADERS[name];
  const colIdx = headers.indexOf(idCol);
  if (colIdx < 0) throw new Error('Columna "' + idCol + '" no existe en ' + name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === idValue) return i + 2;
  }
  return -1;
}

function updateRowById_(name, idCol, idValue, partial) {
  const sh = getSheet_(name);
  const rowIdx = findRowIndex_(sh, name, idCol, idValue);
  if (rowIdx < 0) throw new Error('No se encontro ' + idCol + '=' + idValue + ' en ' + name);
  const headers = HEADERS[name];
  const current = sh.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const updated = headers.map((h, i) => partial[h] !== undefined ? partial[h] : current[i]);
  sh.getRange(rowIdx, 1, 1, headers.length).setValues([updated]);
  invalidateReadCache_(name);
  const obj = {};
  headers.forEach((h, i) => { obj[h] = updated[i]; });
  return obj;
}

function deleteRowById_(name, idCol, idValue) {
  const sh = getSheet_(name);
  const rowIdx = findRowIndex_(sh, name, idCol, idValue);
  if (rowIdx < 0) return false;
  sh.deleteRow(rowIdx);
  invalidateReadCache_(name);
  return true;
}

function deleteRowsWhere_(name, predicate) {
  const sh = getSheet_(name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = values[i][j]; });
    if (predicate(obj)) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  if (removed) invalidateReadCache_(name);
  return removed;
}

function genId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function nowIso_() {
  return new Date().toISOString();
}

function todayIso_() {
  const tz = Session.getScriptTimeZone() || 'UTC';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function isTrue_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}

const MUSCLE_GROUPS_ = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'core', 'piernas'];

const MUSCLE_GROUP_LABELS_ = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  core: 'Core',
  piernas: 'Piernas',
};

const MUSCLE_GROUP_DEFS_ = {
  pecho: [
    'pectoral_superior',
    'pectoral_medio',
    'pectoral_inferior',
  ],
  espalda: [
    'dorsal_ancho',
    'trapecio_superior',
    'trapecio_medio',
    'trapecio_inferior',
    'romboides',
    'redondo_mayor',
    'erectores_espinales',
  ],
  hombros: [
    'deltoide_anterior',
    'deltoide_lateral',
    'deltoide_posterior',
  ],
  biceps: [
    'biceps_cabeza_larga',
    'biceps_cabeza_corta',
    'braquial',
    'braquiorradial',
  ],
  triceps: [
    'triceps_cabeza_larga',
    'triceps_cabeza_lateral',
    'triceps_cabeza_medial',
  ],
  core: [
    'recto_abdominal',
    'oblicuos',
    'serrato',
  ],
  piernas: [
    'cuadriceps',
    'aductores',
    'gluteo_mayor',
    'isquios',
    'gemelos',
    'tibial_anterior',
  ],
};

const MUSCLE_SUBZONE_LABELS_ = {
  pectoral_superior: 'Pectoral superior',
  pectoral_medio: 'Pectoral medio',
  pectoral_inferior: 'Pectoral inferior',
  dorsal_ancho: 'Dorsal ancho',
  trapecio_superior: 'Trapecio superior',
  trapecio_medio: 'Trapecio medio',
  trapecio_inferior: 'Trapecio inferior',
  romboides: 'Romboides',
  redondo_mayor: 'Redondo mayor',
  erectores_espinales: 'Erectores espinales',
  deltoide_anterior: 'Deltoide anterior',
  deltoide_lateral: 'Deltoide lateral',
  deltoide_posterior: 'Deltoide posterior',
  biceps_cabeza_larga: 'Bíceps cabeza larga',
  biceps_cabeza_corta: 'Bíceps cabeza corta',
  braquial: 'Braquial',
  braquiorradial: 'Braquiorradial',
  triceps_cabeza_larga: 'Tríceps cabeza larga',
  triceps_cabeza_lateral: 'Tríceps cabeza lateral',
  triceps_cabeza_medial: 'Tríceps cabeza medial',
  recto_abdominal: 'Recto abdominal',
  oblicuos: 'Oblicuos',
  serrato: 'Serrato',
  cuadriceps: 'Cuádriceps',
  aductores: 'Aductores',
  gluteo_mayor: 'Glúteo mayor',
  isquios: 'Isquios',
  gemelos: 'Gemelos',
  tibial_anterior: 'Tibial anterior',
};

const MUSCLE_SUBZONE_ALIASES_ = {
  pectorales_superior: 'pectoral_superior',
  pectorales_medio: 'pectoral_medio',
  pectorales_inferior: 'pectoral_inferior',
  pecho_superior: 'pectoral_superior',
  pecho_medio: 'pectoral_medio',
  pecho_inferior: 'pectoral_inferior',
  triceps: 'triceps_cabeza_lateral',
  tricep: 'triceps_cabeza_lateral',
  biceps: 'biceps_cabeza_larga',
  bicep: 'biceps_cabeza_larga',
  abs: 'recto_abdominal',
  abdominales: 'recto_abdominal',
  gluteos: 'gluteo_mayor',
  gluteo: 'gluteo_mayor',
  femorales: 'isquios',
  isquiotibiales: 'isquios',
  pantorrillas: 'gemelos',
};

const MUSCLE_GROUP_FALLBACK_DISTRIBUTIONS_ = {
  pecho: {
    pectoral_superior: 25,
    pectoral_medio: 50,
    pectoral_inferior: 25,
  },
  espalda: {
    dorsal_ancho: 32,
    trapecio_superior: 10,
    trapecio_medio: 14,
    trapecio_inferior: 10,
    romboides: 12,
    redondo_mayor: 12,
    erectores_espinales: 10,
  },
  hombros: {
    deltoide_anterior: 34,
    deltoide_lateral: 33,
    deltoide_posterior: 33,
  },
  biceps: {
    biceps_cabeza_larga: 35,
    biceps_cabeza_corta: 35,
    braquial: 20,
    braquiorradial: 10,
  },
  triceps: {
    triceps_cabeza_larga: 40,
    triceps_cabeza_lateral: 35,
    triceps_cabeza_medial: 25,
  },
  core: {
    recto_abdominal: 45,
    oblicuos: 35,
    serrato: 20,
  },
  piernas: {
    cuadriceps: 28,
    aductores: 12,
    gluteo_mayor: 20,
    isquios: 18,
    gemelos: 14,
    tibial_anterior: 8,
  },
};

const EXERCISE_MUSCLE_MAP_ = {
  press_plano: {
    pectoral_medio: 55,
    pectoral_inferior: 10,
    pectoral_superior: 10,
    triceps_cabeza_lateral: 8,
    triceps_cabeza_medial: 7,
    deltoide_anterior: 10,
  },
  press_banca: {
    pectoral_medio: 55,
    pectoral_inferior: 10,
    pectoral_superior: 10,
    triceps_cabeza_lateral: 8,
    triceps_cabeza_medial: 7,
    deltoide_anterior: 10,
  },
  bench_press: {
    pectoral_medio: 55,
    pectoral_inferior: 10,
    pectoral_superior: 10,
    triceps_cabeza_lateral: 8,
    triceps_cabeza_medial: 7,
    deltoide_anterior: 10,
  },
  press_inclinado: {
    pectoral_superior: 45,
    pectoral_medio: 20,
    deltoide_anterior: 20,
    triceps_cabeza_lateral: 5,
    triceps_cabeza_medial: 5,
    serrato: 5,
  },
  press_inclinado_mancuernas: {
    pectoral_superior: 45,
    pectoral_medio: 20,
    deltoide_anterior: 20,
    triceps_cabeza_lateral: 5,
    triceps_cabeza_medial: 5,
    serrato: 5,
  },
  press_militar: {
    deltoide_anterior: 45,
    deltoide_lateral: 25,
    triceps_cabeza_lateral: 12,
    triceps_cabeza_medial: 8,
    serrato: 10,
  },
  elevaciones_laterales: {
    deltoide_lateral: 82,
    deltoide_anterior: 8,
    trapecio_superior: 10,
  },
  vuelos_laterales: {
    deltoide_lateral: 82,
    deltoide_anterior: 8,
    trapecio_superior: 10,
  },
  face_pull: {
    deltoide_posterior: 45,
    trapecio_medio: 22,
    trapecio_inferior: 12,
    romboides: 16,
    braquial: 5,
  },
  dominadas: {
    dorsal_ancho: 45,
    redondo_mayor: 15,
    biceps_cabeza_larga: 8,
    biceps_cabeza_corta: 7,
    braquial: 10,
    trapecio_medio: 5,
    trapecio_inferior: 5,
    deltoide_posterior: 5,
  },
  jalon_al_pecho: {
    dorsal_ancho: 44,
    redondo_mayor: 14,
    biceps_cabeza_larga: 8,
    biceps_cabeza_corta: 8,
    braquial: 10,
    trapecio_medio: 8,
    trapecio_inferior: 5,
    deltoide_posterior: 3,
  },
  remo: {
    dorsal_ancho: 28,
    romboides: 20,
    trapecio_medio: 18,
    deltoide_posterior: 12,
    redondo_mayor: 10,
    biceps_cabeza_larga: 5,
    biceps_cabeza_corta: 4,
    braquial: 3,
  },
  curl_biceps: {
    biceps_cabeza_larga: 38,
    biceps_cabeza_corta: 34,
    braquial: 18,
    braquiorradial: 10,
  },
  curl_martillo: {
    braquial: 38,
    braquiorradial: 32,
    biceps_cabeza_larga: 18,
    biceps_cabeza_corta: 12,
  },
  extension_triceps: {
    triceps_cabeza_larga: 45,
    triceps_cabeza_lateral: 30,
    triceps_cabeza_medial: 25,
  },
  sentadilla: {
    cuadriceps: 40,
    gluteo_mayor: 25,
    aductores: 15,
    isquios: 10,
    erectores_espinales: 5,
    recto_abdominal: 5,
  },
  prensa: {
    cuadriceps: 45,
    gluteo_mayor: 20,
    aductores: 15,
    isquios: 10,
    gemelos: 5,
    recto_abdominal: 5,
  },
  peso_muerto: {
    isquios: 25,
    gluteo_mayor: 25,
    erectores_espinales: 20,
    dorsal_ancho: 10,
    trapecio_superior: 10,
    aductores: 5,
    braquiorradial: 5,
  },
  hip_thrust: {
    gluteo_mayor: 55,
    isquios: 18,
    aductores: 12,
    cuadriceps: 10,
    recto_abdominal: 5,
  },
  zancadas: {
    cuadriceps: 32,
    gluteo_mayor: 30,
    aductores: 14,
    isquios: 14,
    gemelos: 6,
    recto_abdominal: 4,
  },
};

function normalizeMuscleGroup_(value) {
  const v = (value || '').toString().trim().toLowerCase();
  if (!v) return '';
  if (v === 'bicep' || v === 'bícep' || v === 'biceps' || v === 'bíceps') return 'biceps';
  if (v === 'tricep' || v === 'trícep' || v === 'triceps' || v === 'tríceps') return 'triceps';
  if (MUSCLE_GROUPS_.indexOf(v) < 0) throw new Error('Grupo muscular invalido.');
  return v;
}

function safeNormalizeMuscleGroup_(value) {
  try {
    return normalizeMuscleGroup_(value);
  } catch (err) {
    return '';
  }
}

function normalizeExerciseNameKey_(value) {
  return normalizeLookupKey_(value);
}

function normalizeLookupKey_(value) {
  return (value || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getAllMuscleSubzones_() {
  return MUSCLE_GROUPS_.reduce((acc, group) => acc.concat(MUSCLE_GROUP_DEFS_[group] || []), []);
}

function getMuscleSubzoneGroup_(subzone) {
  const key = normalizeMuscleSubzoneKey_(subzone);
  for (let i = 0; i < MUSCLE_GROUPS_.length; i++) {
    const group = MUSCLE_GROUPS_[i];
    if ((MUSCLE_GROUP_DEFS_[group] || []).indexOf(key) >= 0) return group;
  }
  return '';
}

function normalizeMuscleSubzoneKey_(value) {
  const key = normalizeLookupKey_(value);
  if (!key) return '';
  return MUSCLE_SUBZONE_ALIASES_[key] || key;
}

function cloneDistribution_(dist) {
  const out = {};
  Object.keys(dist || {}).forEach(key => { out[key] = Number(dist[key] || 0); });
  return out;
}

function parseMuscleDistribution_(value) {
  if (value === undefined || value === null || value === '') return {};
  let raw = value;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      raw = JSON.parse(trimmed);
    } catch (err) {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const dist = {};
  Object.keys(raw).forEach(rawKey => {
    const subzone = normalizeMuscleSubzoneKey_(rawKey);
    if (!subzone || !getMuscleSubzoneGroup_(subzone)) return;
    const percent = Number(raw[rawKey]);
    if (!isFinite(percent) || percent <= 0) return;
    dist[subzone] = (dist[subzone] || 0) + percent;
  });
  return normalizeDistributionTotal_(dist);
}

function normalizeDistributionTotal_(dist) {
  const keys = Object.keys(dist || {}).filter(key => Number(dist[key]) > 0);
  if (!keys.length) return {};
  const total = keys.reduce((sum, key) => sum + Number(dist[key] || 0), 0);
  if (!isFinite(total) || total <= 0) return {};
  const out = {};
  let roundedTotal = 0;
  keys.forEach(key => {
    const value = Math.round((Number(dist[key]) / total) * 10000) / 100;
    out[key] = value;
    roundedTotal += value;
  });
  const diff = Math.round((100 - roundedTotal) * 100) / 100;
  if (keys.length && diff !== 0) {
    out[keys[0]] = Math.round((out[keys[0]] + diff) * 100) / 100;
  }
  return out;
}

function defaultMuscleDistribution_(exerciseName, fallbackGroup) {
  const nameKey = normalizeExerciseNameKey_(exerciseName);
  const mapKey = getExerciseMuscleMapKey_(nameKey);
  if (mapKey && EXERCISE_MUSCLE_MAP_[mapKey]) {
    return cloneDistribution_(EXERCISE_MUSCLE_MAP_[mapKey]);
  }
  const group = safeNormalizeMuscleGroup_(fallbackGroup);
  if (group && MUSCLE_GROUP_FALLBACK_DISTRIBUTIONS_[group]) {
    return cloneDistribution_(MUSCLE_GROUP_FALLBACK_DISTRIBUTIONS_[group]);
  }
  return {};
}

function getExerciseMuscleMapKey_(nameKey) {
  if (!nameKey) return '';
  if (EXERCISE_MUSCLE_MAP_[nameKey]) return nameKey;
  if (nameKey.indexOf('press_inclinado') >= 0) return 'press_inclinado';
  if (nameKey.indexOf('press_plano') >= 0 || nameKey.indexOf('press_banca') >= 0) return 'press_plano';
  if (nameKey.indexOf('press_militar') >= 0 || nameKey.indexOf('overhead_press') >= 0) return 'press_militar';
  if (nameKey.indexOf('elevacion_lateral') >= 0 || nameKey.indexOf('elevaciones_laterales') >= 0 || nameKey.indexOf('vuelos_laterales') >= 0) return 'elevaciones_laterales';
  if (nameKey.indexOf('face_pull') >= 0) return 'face_pull';
  if (nameKey.indexOf('dominad') >= 0 || nameKey.indexOf('pull_up') >= 0) return 'dominadas';
  if (nameKey.indexOf('jalon') >= 0 || nameKey.indexOf('lat_pulldown') >= 0) return 'jalon_al_pecho';
  if (nameKey.indexOf('remo') >= 0 || nameKey.indexOf('row') >= 0) return 'remo';
  if (nameKey.indexOf('curl_martillo') >= 0) return 'curl_martillo';
  if (nameKey.indexOf('curl') >= 0) return 'curl_biceps';
  if (nameKey.indexOf('extension_triceps') >= 0 || nameKey.indexOf('pushdown') >= 0) return 'extension_triceps';
  if (nameKey.indexOf('sentadilla') >= 0 || nameKey.indexOf('squat') >= 0) return 'sentadilla';
  if (nameKey.indexOf('prensa') >= 0 || nameKey.indexOf('leg_press') >= 0) return 'prensa';
  if (nameKey.indexOf('peso_muerto') >= 0 || nameKey.indexOf('deadlift') >= 0) return 'peso_muerto';
  if (nameKey.indexOf('hip_thrust') >= 0) return 'hip_thrust';
  if (nameKey.indexOf('zancada') >= 0 || nameKey.indexOf('lunge') >= 0) return 'zancadas';
  return '';
}

function normalizeMuscleDistribution_(value, fallbackGroup, exerciseName) {
  const parsed = parseMuscleDistribution_(value);
  if (Object.keys(parsed).length) return parsed;
  return defaultMuscleDistribution_(exerciseName, fallbackGroup);
}

function serializeMuscleDistribution_(value, fallbackGroup, exerciseName) {
  const dist = normalizeMuscleDistribution_(value, fallbackGroup, exerciseName);
  return Object.keys(dist).length ? JSON.stringify(dist) : '';
}

function dominantMuscleGroupFromDistribution_(distribution) {
  const totals = {};
  Object.keys(distribution || {}).forEach(subzone => {
    const group = getMuscleSubzoneGroup_(subzone);
    if (!group) return;
    totals[group] = (totals[group] || 0) + Number(distribution[subzone] || 0);
  });
  return Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b))[0] || '';
}

function resolveExerciseMuscleGroup_(exercise, exerciseMeta) {
  const direct = safeNormalizeMuscleGroup_(exercise && exercise.muscle_group);
  if (direct) return direct;
  const byId = exerciseMeta && exercise && exercise.routine_exercise_id
    ? exerciseMeta.byId[exercise.routine_exercise_id]
    : '';
  if (byId) return byId;
  const nameKey = normalizeExerciseNameKey_(exercise && exercise.exercise_name);
  const byName = (exerciseMeta && nameKey && exerciseMeta.byName[nameKey]) || '';
  if (byName) return byName;
  const distribution = normalizeMuscleDistribution_(
    exercise && (exercise.muscleDistribution || exercise.muscle_distribution),
    '',
    exercise && exercise.exercise_name
  );
  return dominantMuscleGroupFromDistribution_(distribution);
}

function normalizeWeekDays_(value) {
  let raw = value;
  if (Array.isArray(raw)) {
    raw = raw.join(',');
  }
  const seen = {};
  return (raw || '').toString().split(',')
    .map(v => parseInt(v, 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 7)
    .filter(n => {
      if (seen[n]) return false;
      seen[n] = true;
      return true;
    })
    .sort((a, b) => a - b)
    .join(',');
}

function parseWeekDays_(value) {
  return normalizeWeekDays_(value)
    .split(',')
    .filter(Boolean)
    .map(Number);
}

function getIsoWeekday_(isoDate) {
  const date = parseIsoDateLocal_(isoDate);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

// ============================================================
// PING — usado por el frontend para verificar conexion
// ============================================================

function ping() {
  return { ok: true, time: nowIso_(), today: todayIso_() };
}

// ============================================================
// ROUTINES API
// ============================================================

function listRoutines() {
  const routines = readAll_(SHEETS.ROUTINES);

  return routines
    .map(r => ({
      routine_id: r.routine_id,
      routine_name: r.routine_name,
      created_at: r.created_at,
      is_active: isTrue_(r.is_active),
    }))
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });
}

function createRoutine(name) {
  name = (name || '').toString().trim();
  if (!name) throw new Error('El nombre no puede estar vacio.');
  if (name.length > 80) throw new Error('Nombre demasiado largo (max 80 caracteres).');

  const existing = readAll_(SHEETS.ROUTINES);
  const isFirst = existing.length === 0;

  const routine = {
    routine_id: genId_('r'),
    routine_name: name,
    created_at: nowIso_(),
    is_active: isFirst,
  };
  appendRow_(SHEETS.ROUTINES, routine);
  return Object.assign({}, routine, { day_count: 0, exercise_count: 0 });
}

function renameRoutine(routine_id, new_name) {
  new_name = (new_name || '').toString().trim();
  if (!new_name) throw new Error('El nombre no puede estar vacio.');
  if (new_name.length > 80) throw new Error('Nombre demasiado largo.');
  return updateRowById_(SHEETS.ROUTINES, 'routine_id', routine_id, { routine_name: new_name });
}

function duplicateRoutine(params) {
  params = params || {};
  const routine_id = (params.routine_id || '').toString().trim();
  let new_name = (params.new_name || '').toString().trim();
  if (!routine_id) throw new Error('routine_id requerido.');
  if (!new_name) throw new Error('El nombre no puede estar vacio.');
  if (new_name.length > 80) throw new Error('Nombre demasiado largo.');

  const routines = readAll_(SHEETS.ROUTINES);
  const source = routines.find(r => r.routine_id === routine_id);
  if (!source) throw new Error('Rutina no encontrada.');

  const sourceDays = readAll_(SHEETS.DAYS)
    .filter(d => d.routine_id === routine_id)
    .sort((a, b) => Number(a.day_order || 0) - Number(b.day_order || 0));
  const allExercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(allExercises);
  const sourceDayIds = sourceDays.map(day => day.day_id);
  const sourceExercises = allExercises.filter(ex => sourceDayIds.indexOf(ex.day_id) >= 0);
  const missingMuscles = sourceExercises
    .filter(ex => !resolveExerciseMuscleGroup_(ex, exerciseMeta))
    .map(ex => (ex.exercise_name || '').toString().trim())
    .filter(Boolean)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .slice(0, 5);
  if (missingMuscles.length) {
    throw new Error('Completá el grupo muscular de ' + missingMuscles.join(', ') + ' antes de duplicar la rutina.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const newRoutineId = genId_('r');
    appendRow_(SHEETS.ROUTINES, {
      routine_id: newRoutineId,
      routine_name: new_name,
      created_at: nowIso_(),
      is_active: false,
    });

    const dayIdMap = {};
    sourceDays.forEach(day => {
      const newDayId = genId_('day');
      dayIdMap[day.day_id] = newDayId;
      appendRow_(SHEETS.DAYS, {
        day_id: newDayId,
        routine_id: newRoutineId,
        day_name: day.day_name,
        day_order: Number(day.day_order || 0),
        week_days: normalizeWeekDays_(day.week_days),
      });
    });

    sourceDays.forEach(day => {
      allExercises
        .filter(ex => ex.day_id === day.day_id)
        .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0))
        .forEach(ex => {
          const muscleGroup = resolveExerciseMuscleGroup_(ex, exerciseMeta);
          const muscleDistribution = resolveExerciseMuscleDistribution_(ex, exerciseMeta);
          appendRow_(SHEETS.EXERCISES, {
            routine_exercise_id: genId_('rex'),
            day_id: dayIdMap[day.day_id],
            exercise_order: Number(ex.exercise_order || 0),
            exercise_name: ex.exercise_name,
            target_sets: Number(ex.target_sets || 0),
            target_reps_min: Number(ex.target_reps_min || 0),
            target_reps_max: Number(ex.target_reps_max || 0),
            suggested_weight: ex.suggested_weight,
            technique_note: ex.technique_note || '',
            muscle_group: muscleGroup,
            muscle_distribution: serializeMuscleDistribution_(muscleDistribution, muscleGroup, ex.exercise_name),
          });
        });
    });

    return getRoutine(newRoutineId);
  } finally {
    lock.releaseLock();
  }
}

function setActiveRoutine(routine_id) {
  const sh = getSheet_(SHEETS.ROUTINES);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('No hay rutinas.');
  const headers = HEADERS[SHEETS.ROUTINES];
  const idCol = headers.indexOf('routine_id') + 1;
  const activeCol = headers.indexOf('is_active') + 1;
  const ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  let found = false;
  const updates = ids.map(row => {
    const match = row[0] === routine_id;
    if (match) found = true;
    return [match];
  });
  if (!found) throw new Error('Rutina no encontrada: ' + routine_id);
  sh.getRange(2, activeCol, lastRow - 1, 1).setValues(updates);
  invalidateReadCache_(SHEETS.ROUTINES);
  return { ok: true, routine_id: routine_id };
}

function deleteRoutine(routine_id) {
  const days = readAll_(SHEETS.DAYS).filter(d => d.routine_id === routine_id);
  const dayIds = days.map(d => d.day_id);
  if (dayIds.length > 0) {
    deleteRowsWhere_(SHEETS.EXERCISES, e => dayIds.indexOf(e.day_id) >= 0);
    deleteRowsWhere_(SHEETS.DAYS, d => d.routine_id === routine_id);
  }
  const ok = deleteRowById_(SHEETS.ROUTINES, 'routine_id', routine_id);

  // Si la borrada era la activa, activa la primera disponible
  const remaining = readAll_(SHEETS.ROUTINES);
  if (remaining.length > 0 && !remaining.some(r => isTrue_(r.is_active))) {
    setActiveRoutine(remaining[0].routine_id);
  }
  return { ok: ok };
}

function getRoutine(routine_id) {
  const routines = readAll_(SHEETS.ROUTINES);
  const r = routines.find(x => x.routine_id === routine_id);
  if (!r) throw new Error('Rutina no encontrada.');

  const days = readAll_(SHEETS.DAYS)
    .filter(d => d.routine_id === routine_id)
    .sort((a, b) => Number(a.day_order || 0) - Number(b.day_order || 0));

  const exercises = readAll_(SHEETS.EXERCISES);
  const dayIds = days.map(d => d.day_id);

  const result = days.map(d => ({
    day_id: d.day_id,
    day_name: d.day_name,
    day_order: Number(d.day_order || 0),
    week_days: parseWeekDays_(d.week_days),
    exercises: exercises
      .filter(e => e.day_id === d.day_id)
      .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0))
      .map(e => {
        const muscleGroup = normalizeMuscleGroup_(e.muscle_group);
        const muscleDistribution = normalizeMuscleDistribution_(e.muscle_distribution, muscleGroup, e.exercise_name);
        return {
          routine_exercise_id: e.routine_exercise_id,
          exercise_order: Number(e.exercise_order || 0),
          exercise_name: e.exercise_name,
          target_sets: Number(e.target_sets || 0),
          target_reps_min: Number(e.target_reps_min || 0),
          target_reps_max: Number(e.target_reps_max || 0),
          suggested_weight: e.suggested_weight === '' ? null : Number(e.suggested_weight),
          technique_note: e.technique_note || '',
          muscle_group: muscleGroup,
          muscleDistribution,
          muscle_distribution: JSON.stringify(muscleDistribution),
        };
      }),
  }));

  return {
    routine_id: r.routine_id,
    routine_name: r.routine_name,
    created_at: r.created_at,
    is_active: isTrue_(r.is_active),
    days: result,
  };
}

// ============================================================
// DAYS API — Parte 3
// ============================================================

function addDay(params) {
  const routine_id = (params.routine_id || '').toString().trim();
  const day_name   = (params.day_name   || '').toString().trim();
  if (!routine_id) throw new Error('routine_id requerido.');
  if (!day_name)   throw new Error('El nombre del día no puede estar vacío.');
  if (day_name.length > 50) throw new Error('Nombre demasiado largo (max 50 caracteres).');

  const routines = readAll_(SHEETS.ROUTINES);
  if (!routines.some(r => r.routine_id === routine_id)) throw new Error('Rutina no encontrada.');

  const existing  = readAll_(SHEETS.DAYS).filter(d => d.routine_id === routine_id);
  const nextOrder = existing.length > 0
    ? Math.max(...existing.map(d => Number(d.day_order || 0))) + 1
    : 1;

  appendRow_(SHEETS.DAYS, {
    day_id:     genId_('day'),
    routine_id,
    day_name,
    day_order:  nextOrder,
    week_days:  normalizeWeekDays_(params.week_days),
  });
  return getRoutine(routine_id);
}

function renameDay(params) {
  const day_id   = (params.day_id   || '').toString().trim();
  const new_name = (params.new_name || '').toString().trim();
  if (!day_id)   throw new Error('day_id requerido.');
  if (!new_name) throw new Error('El nombre no puede estar vacío.');
  if (new_name.length > 50) throw new Error('Nombre demasiado largo (max 50 caracteres).');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');
  updateRowById_(SHEETS.DAYS, 'day_id', day_id, { day_name: new_name });
  return getRoutine(day.routine_id);
}

function updateDayWeekDays(params) {
  params = params || {};
  const day_id = (params.day_id || '').toString().trim();
  if (!day_id) throw new Error('day_id requerido.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  updateRowById_(SHEETS.DAYS, 'day_id', day_id, {
    week_days: normalizeWeekDays_(params.week_days),
  });
  return getRoutine(day.routine_id);
}

function deleteDay(params) {
  const day_id = (params.day_id || '').toString().trim();
  if (!day_id) throw new Error('day_id requerido.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  deleteRowsWhere_(SHEETS.EXERCISES, e => e.day_id === day_id);
  deleteRowById_(SHEETS.DAYS, 'day_id', day_id);
  return getRoutine(day.routine_id);
}

function reorderDay(params) {
  const day_id   = (params.day_id   || '').toString().trim();
  const direction = (params.direction || '').toString().trim();
  if (!day_id) throw new Error('day_id requerido.');
  if (direction !== 'up' && direction !== 'down') throw new Error('direction debe ser "up" o "down".');

  const allDays = readAll_(SHEETS.DAYS);
  const day = allDays.find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  const siblings = allDays
    .filter(d => d.routine_id === day.routine_id)
    .sort((a, b) => Number(a.day_order) - Number(b.day_order));

  const idx = siblings.findIndex(d => d.day_id === day_id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return getRoutine(day.routine_id);

  const target = siblings[swapIdx];
  const tempOrder = Number(day.day_order);
  updateRowById_(SHEETS.DAYS, 'day_id', day_id,      { day_order: Number(target.day_order) });
  updateRowById_(SHEETS.DAYS, 'day_id', target.day_id, { day_order: tempOrder });
  return getRoutine(day.routine_id);
}

// ============================================================
// EXERCISES API — Parte 3
// ============================================================

function addExercise(params) {
  const day_id        = (params.day_id        || '').toString().trim();
  const exercise_name = (params.exercise_name || '').toString().trim();
  const target_sets   = parseInt(params.target_sets,     10);
  const rmin          = parseInt(params.target_reps_min, 10);
  const rmax          = parseInt(params.target_reps_max, 10);
  const swRaw         = params.suggested_weight;
  const technique_note = (params.technique_note || '').toString().trim();
  const muscle_group = normalizeMuscleGroup_(params.muscle_group);
  const muscle_distribution = serializeMuscleDistribution_(
    params.muscleDistribution !== undefined ? params.muscleDistribution : params.muscle_distribution,
    muscle_group,
    exercise_name
  );

  if (!day_id)        throw new Error('day_id requerido.');
  if (!exercise_name) throw new Error('El nombre del ejercicio no puede estar vacío.');
  if (exercise_name.length > 100) throw new Error('Nombre demasiado largo (max 100 caracteres).');
  if (isNaN(target_sets) || target_sets < 1 || target_sets > 20) throw new Error('target_sets debe ser 1-20.');
  if (isNaN(rmin) || rmin < 1 || rmin > 100) throw new Error('target_reps_min debe ser 1-100.');
  if (isNaN(rmax) || rmax < 1 || rmax > 100) throw new Error('target_reps_max debe ser 1-100.');
  if (rmin > rmax) throw new Error('target_reps_min no puede ser mayor que target_reps_max.');
  if (!muscle_group) throw new Error('Elegí el grupo muscular principal.');

  let suggested_weight = '';
  if (swRaw !== undefined && swRaw !== null && swRaw !== '') {
    const n = Number(swRaw);
    if (isNaN(n) || n < 0) throw new Error('El peso sugerido debe ser ≥ 0.');
    suggested_weight = n;
  }

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  const existing  = readAll_(SHEETS.EXERCISES).filter(e => e.day_id === day_id);
  const nextOrder = existing.length > 0
    ? Math.max(...existing.map(e => Number(e.exercise_order || 0))) + 1
    : 1;

  appendRow_(SHEETS.EXERCISES, {
    routine_exercise_id: genId_('rex'),
    day_id,
    exercise_order:  nextOrder,
    exercise_name,
    target_sets,
    target_reps_min: rmin,
    target_reps_max: rmax,
    suggested_weight,
    technique_note,
    muscle_group,
    muscle_distribution,
  });
  return getRoutine(day.routine_id);
}

function updateExercise(params) {
  const rex_id = (params.routine_exercise_id || '').toString().trim();
  if (!rex_id) throw new Error('routine_exercise_id requerido.');

  const ex = readAll_(SHEETS.EXERCISES).find(e => e.routine_exercise_id === rex_id);
  if (!ex) throw new Error('Ejercicio no encontrado.');

  const partial = {};

  if (params.exercise_name !== undefined) {
    const name = params.exercise_name.toString().trim();
    if (!name) throw new Error('El nombre no puede estar vacío.');
    if (name.length > 100) throw new Error('Nombre demasiado largo (max 100 caracteres).');
    partial.exercise_name = name;
  }
  if (params.target_sets !== undefined) {
    const ts = parseInt(params.target_sets, 10);
    if (isNaN(ts) || ts < 1 || ts > 20) throw new Error('target_sets debe ser 1-20.');
    partial.target_sets = ts;
  }
  if (params.target_reps_min !== undefined || params.target_reps_max !== undefined) {
    const rmin = parseInt(params.target_reps_min !== undefined ? params.target_reps_min : ex.target_reps_min, 10);
    const rmax = parseInt(params.target_reps_max !== undefined ? params.target_reps_max : ex.target_reps_max, 10);
    if (isNaN(rmin) || rmin < 1 || rmin > 100) throw new Error('target_reps_min debe ser 1-100.');
    if (isNaN(rmax) || rmax < 1 || rmax > 100) throw new Error('target_reps_max debe ser 1-100.');
    if (rmin > rmax) throw new Error('target_reps_min no puede ser mayor que target_reps_max.');
    partial.target_reps_min = rmin;
    partial.target_reps_max = rmax;
  }
  if (params.suggested_weight !== undefined) {
    if (params.suggested_weight === '' || params.suggested_weight === null) {
      partial.suggested_weight = '';
    } else {
      const sw = Number(params.suggested_weight);
      if (isNaN(sw) || sw < 0) throw new Error('El peso sugerido debe ser ≥ 0.');
      partial.suggested_weight = sw;
    }
  }
  if (params.technique_note !== undefined) {
    partial.technique_note = params.technique_note.toString().trim();
  }
  if (params.muscle_group !== undefined) {
    const muscleGroup = normalizeMuscleGroup_(params.muscle_group);
    if (!muscleGroup) throw new Error('Elegí el grupo muscular principal.');
    partial.muscle_group = muscleGroup;
  }
  if (
    params.muscleDistribution !== undefined ||
    params.muscle_distribution !== undefined ||
    partial.exercise_name !== undefined ||
    partial.muscle_group !== undefined
  ) {
    const nextName = partial.exercise_name !== undefined ? partial.exercise_name : ex.exercise_name;
    const nextGroup = partial.muscle_group !== undefined ? partial.muscle_group : normalizeMuscleGroup_(ex.muscle_group);
    const rawDistribution = params.muscleDistribution !== undefined ? params.muscleDistribution : params.muscle_distribution;
    partial.muscle_distribution = serializeMuscleDistribution_(rawDistribution, nextGroup, nextName);
  }

  updateRowById_(SHEETS.EXERCISES, 'routine_exercise_id', rex_id, partial);

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
  if (!day) throw new Error('Día no encontrado.');
  return getRoutine(day.routine_id);
}

function deleteExercise(params) {
  const rex_id = (params.routine_exercise_id || '').toString().trim();
  if (!rex_id) throw new Error('routine_exercise_id requerido.');

  const ex = readAll_(SHEETS.EXERCISES).find(e => e.routine_exercise_id === rex_id);
  if (!ex) throw new Error('Ejercicio no encontrado.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
  if (!day) throw new Error('Día no encontrado.');

  deleteRowById_(SHEETS.EXERCISES, 'routine_exercise_id', rex_id);
  return getRoutine(day.routine_id);
}

function reorderExercise(params) {
  const rex_id   = (params.routine_exercise_id || '').toString().trim();
  const direction = (params.direction || '').toString().trim();
  if (!rex_id) throw new Error('routine_exercise_id requerido.');
  if (direction !== 'up' && direction !== 'down') throw new Error('direction debe ser "up" o "down".');

  const allEx = readAll_(SHEETS.EXERCISES);
  const ex = allEx.find(e => e.routine_exercise_id === rex_id);
  if (!ex) throw new Error('Ejercicio no encontrado.');

  const siblings = allEx
    .filter(e => e.day_id === ex.day_id)
    .sort((a, b) => Number(a.exercise_order) - Number(b.exercise_order));

  const idx = siblings.findIndex(e => e.routine_exercise_id === rex_id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
    return getRoutine(day.routine_id);
  }

  const target = siblings[swapIdx];
  const tempOrder = Number(ex.exercise_order);
  updateRowById_(SHEETS.EXERCISES, 'routine_exercise_id', rex_id,         { exercise_order: Number(target.exercise_order) });
  updateRowById_(SHEETS.EXERCISES, 'routine_exercise_id', target.routine_exercise_id, { exercise_order: tempOrder });

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
  return getRoutine(day.routine_id);
}

// ============================================================
// TRAINING API — Parte 4
// ============================================================

function normalizeDate_(value) {
  if (!value) return todayIso_();
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    const tz = Session.getScriptTimeZone() || 'UTC';
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = value.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('Fecha invalida.');
  const tz = Session.getScriptTimeZone() || 'UTC';
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function getActiveRoutine() {
  const active = readAll_(SHEETS.ROUTINES).find(r => isTrue_(r.is_active));
  if (!active) throw new Error('No hay rutina activa. Marcá una rutina como activa primero.');
  return getRoutine(active.routine_id);
}

function getTrainPickData(params) {
  params = params || {};
  const routines = listRoutines();
  if (!routines.length) {
    return { routines: [], routine: null };
  }
  const requestedId = (params.routine_id || '').toString().trim();
  const selected = routines.find(r => r.routine_id === requestedId)
    || routines.find(r => r.is_active)
    || routines[0];
  return {
    routines,
    selected_routine_id: selected.routine_id,
    routine: null,
  };
}

function getLastSessionForDay(params) {
  params = params || {};
  const day_id = (params.day_id || '').toString().trim();
  const beforeDate = normalizeDate_(params.date);
  if (!day_id) throw new Error('day_id requerido.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  const exercises = readAll_(SHEETS.EXERCISES)
    .filter(e => e.day_id === day_id)
    .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0));

  const nameByRexId = {};
  readAll_(SHEETS.EXERCISES).forEach(e => {
    if (e.routine_exercise_id && e.exercise_name) {
      nameByRexId[e.routine_exercise_id] = e.exercise_name;
    }
  });

  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(s => normalizeDate_(s.date) < beforeDate)
    .sort((a, b) => {
      const dateCmp = normalizeDate_(b.date).localeCompare(normalizeDate_(a.date));
      if (dateCmp !== 0) return dateCmp;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });

  const sessionIndex = {};
  const dateBySessionId = {};
  sessions.forEach(s => {
    sessionIndex[s.session_id] = true;
    dateBySessionId[s.session_id] = normalizeDate_(s.date);
  });

  const setsBySessionAndName = {};
  const prByName = {};
  readAll_(SHEETS.SETS).forEach(set => {
    if (!sessionIndex[set.session_id]) return;
    const rawName = set.exercise_name || nameByRexId[set.routine_exercise_id] || '';
    const nameKey = normalizeExerciseNameKey_(rawName);
    if (!nameKey) return;
    const key = set.session_id + '|' + nameKey;
    if (!setsBySessionAndName[key]) setsBySessionAndName[key] = [];
    setsBySessionAndName[key].push(set);

    const w = set.weight === '' ? null : Number(set.weight);
    const r = set.reps === '' ? null : Number(set.reps);
    if (w == null || !(w > 0)) return;
    const current = prByName[nameKey];
    const beats = !current || w > current.weight;
    if (beats) {
      prByName[nameKey] = {
        weight: w,
        reps: r,
        date: dateBySessionId[set.session_id] || '',
      };
    }
  });

  const result = {};

  exercises.forEach(ex => {
    const nameKey = normalizeExerciseNameKey_(ex.exercise_name);
    if (!nameKey) return;
    const pr = prByName[nameKey] || null;
    let lastEntry = null;
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      if (session.day_id !== day_id) continue;
      const sessionSets = (setsBySessionAndName[session.session_id + '|' + nameKey] || [])
        .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
        .map(set => ({
          set_number: Number(set.set_number || 0),
          weight: set.weight === '' ? null : Number(set.weight),
          reps: set.reps === '' ? null : Number(set.reps),
          rir: set.rir === '' ? null : Number(set.rir),
          note: set.note || '',
        }));
      if (sessionSets.length > 0) {
        lastEntry = {
          session_id: session.session_id,
          date: normalizeDate_(session.date),
          sets: sessionSets,
        };
        break;
      }
    }
    if (lastEntry || pr) {
      result[ex.routine_exercise_id] = Object.assign({}, lastEntry || { sets: [] }, { pr });
    }
  });

  return result;
}

// ============================================================
// SESSIONS API — Parte 5
// ============================================================

function saveSession(params) {
  params = params || {};
  const date = normalizeDate_(params.date);
  const routine_id = (params.routine_id || '').toString().trim();
  const day_id = (params.day_id || '').toString().trim();
  if (!routine_id) throw new Error('routine_id requerido.');
  if (!day_id) throw new Error('day_id requerido.');

  const routine = readAll_(SHEETS.ROUTINES).find(r => r.routine_id === routine_id);
  if (!routine) throw new Error('Rutina no encontrada.');
  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id && d.routine_id === routine_id);
  if (!day) throw new Error('Día no encontrado en esta rutina.');

  const bodyweight = normalizeOptionalNumber_(params.bodyweight, 'bodyweight');
  validateBodyweight_(bodyweight);
  const notes = (params.notes || '').toString().trim();
  const prepared = prepareSessionExercises_(params.exercises || []);
  if (prepared.setCount === 0) throw new Error('Cargá al menos una serie con peso o reps.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const session = appendRow_(SHEETS.SESSIONS, {
      session_id: genId_('ses'),
      date,
      routine_id,
      day_id,
      bodyweight: bodyweight === null ? '' : bodyweight,
      notes,
      created_at: nowIso_(),
      routine_name: routine.routine_name || '',
      day_name: day.day_name || '',
    });

    const setRows = [];
    prepared.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        setRows.push({
          set_id: genId_('set'),
          session_id: session.session_id,
          routine_exercise_id: ex.routine_exercise_id,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group || '',
          muscle_distribution: ex.muscle_distribution || '',
          set_number: set.set_number,
          weight: set.weight === null ? '' : set.weight,
          reps: set.reps === null ? '' : set.reps,
          rir: set.rir === null ? '' : set.rir,
          note: set.note || '',
        });
      });
    });
    appendRows_(SHEETS.SETS, setRows);

    const summary = buildSessionSummary_(session, prepared.exercises, routine, day);
    return { session, summary };
  } finally {
    lock.releaseLock();
  }
}

function getSession(params) {
  params = params || {};
  const session_id = (params.session_id || '').toString().trim();
  if (!session_id) throw new Error('session_id requerido.');

  const session = readAll_(SHEETS.SESSIONS).find(s => s.session_id === session_id);
  if (!session) throw new Error('Sesión no encontrada.');

  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const exerciseMeta = buildExerciseMuscleMeta_(readAll_(SHEETS.EXERCISES));
  const routine = routines.find(r => r.routine_id === session.routine_id) || {};
  const day = days.find(d => d.day_id === session.day_id) || {};
  const sets = readAll_(SHEETS.SETS)
    .filter(s => s.session_id === session_id)
    .sort((a, b) => {
      const nameCmp = (a.exercise_name || '').toString().localeCompare((b.exercise_name || '').toString());
      if (nameCmp !== 0) return nameCmp;
      return Number(a.set_number || 0) - Number(b.set_number || 0);
    });

  const grouped = {};
  sets.forEach(set => {
    const rexId = set.routine_exercise_id || set.exercise_name;
    const muscleGroup = resolveSetMuscleGroup_(set, exerciseMeta);
    const muscleDistribution = resolveSetMuscleDistribution_(set, exerciseMeta);
    if (!grouped[rexId]) {
      grouped[rexId] = {
        routine_exercise_id: set.routine_exercise_id,
        exercise_name: set.exercise_name,
        muscle_group: muscleGroup,
        muscleDistribution,
        muscle_distribution: JSON.stringify(muscleDistribution),
        sets: [],
      };
    }
    if (!grouped[rexId].muscle_group) {
      grouped[rexId].muscle_group = muscleGroup;
    }
    if (!Object.keys(grouped[rexId].muscleDistribution || {}).length && Object.keys(muscleDistribution).length) {
      grouped[rexId].muscleDistribution = muscleDistribution;
      grouped[rexId].muscle_distribution = JSON.stringify(muscleDistribution);
    }
    grouped[rexId].sets.push({
      set_number: Number(set.set_number || 0),
      weight: set.weight === '' ? null : Number(set.weight),
      reps: set.reps === '' ? null : Number(set.reps),
      rir: set.rir === '' ? null : Number(set.rir),
      note: set.note || '',
    });
  });

  return {
    session_id: session.session_id,
    date: normalizeDate_(session.date),
    routine_id: session.routine_id,
    routine_name: session.routine_name || routine.routine_name || '',
    day_id: session.day_id,
    day_name: session.day_name || day.day_name || '',
    bodyweight: session.bodyweight === '' ? null : Number(session.bodyweight),
    notes: session.notes || '',
    created_at: session.created_at,
    exercises: Object.keys(grouped).map(k => grouped[k]),
  };
}

function deleteSession(params) {
  params = params || {};
  const session_id = (params.session_id || '').toString().trim();
  if (!session_id) throw new Error('session_id requerido.');

  const session = readAll_(SHEETS.SESSIONS).find(s => s.session_id === session_id);
  if (!session) throw new Error('Sesión no encontrada.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRowsWhere_(SHEETS.SETS, set => set.session_id === session_id);
    deleteRowById_(SHEETS.SESSIONS, 'session_id', session_id);
    return { ok: true, session_id };
  } finally {
    lock.releaseLock();
  }
}

function editSession(params) {
  params = params || {};
  const session_id = (params.session_id || '').toString().trim();
  if (!session_id) throw new Error('session_id requerido.');

  const existing = readAll_(SHEETS.SESSIONS).find(s => s.session_id === session_id);
  if (!existing) throw new Error('Sesión no encontrada.');

  const date = normalizeDate_(params.date || existing.date);
  const routine_id = (params.routine_id || existing.routine_id || '').toString().trim();
  const day_id = (params.day_id || existing.day_id || '').toString().trim();
  const bodyweight = normalizeOptionalNumber_(params.bodyweight, 'bodyweight');
  validateBodyweight_(bodyweight);
  const notes = (params.notes || '').toString().trim();
  const prepared = prepareSessionExercises_(params.exercises || []);
  if (prepared.setCount === 0) throw new Error('Cargá al menos una serie con peso o reps.');

  const routine = readAll_(SHEETS.ROUTINES).find(r => r.routine_id === routine_id);
  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const session = updateRowById_(SHEETS.SESSIONS, 'session_id', session_id, {
      date,
      routine_id,
      day_id,
      bodyweight: bodyweight === null ? '' : bodyweight,
      notes,
      routine_name: (routine && routine.routine_name) || existing.routine_name || '',
      day_name: (day && day.day_name) || existing.day_name || '',
    });

    deleteRowsWhere_(SHEETS.SETS, set => set.session_id === session_id);
    const setRows = [];
    prepared.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        setRows.push({
          set_id: genId_('set'),
          session_id,
          routine_exercise_id: ex.routine_exercise_id,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group || '',
          muscle_distribution: ex.muscle_distribution || '',
          set_number: set.set_number,
          weight: set.weight === null ? '' : set.weight,
          reps: set.reps === null ? '' : set.reps,
          rir: set.rir === null ? '' : set.rir,
          note: set.note || '',
        });
      });
    });
    appendRows_(SHEETS.SETS, setRows);

    const summary = buildSessionSummary_(session, prepared.exercises, routine || {}, day || {});
    return { session: getSession({ session_id }), summary };
  } finally {
    lock.releaseLock();
  }
}

function prepareSessionExercises_(items) {
  if (!Array.isArray(items)) throw new Error('exercises debe ser un array.');
  const routineExercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(routineExercises);
  const prepared = [];
  let setCount = 0;

  items.forEach(item => {
    const rexId = (item.routine_exercise_id || '').toString().trim();
    if (!rexId) return;
    const template = routineExercises.find(e => e.routine_exercise_id === rexId);
    const exerciseName = ((item.exercise_name || (template && template.exercise_name) || '') + '').trim();
    if (!exerciseName) throw new Error('Nombre de ejercicio requerido.');
    if (exerciseName.length > 100) throw new Error('Nombre de ejercicio demasiado largo.');

    const sets = [];
    (item.sets || []).forEach((rawSet, idx) => {
      const weight = normalizeOptionalNumber_(rawSet.weight, 'weight');
      const reps = normalizeOptionalInteger_(rawSet.reps, 'reps');
      const rir = normalizeOptionalInteger_(rawSet.rir, 'rir');
      const note = (rawSet.note || '').toString().trim();
      if (weight === null && reps === null) return;
      if (weight !== null && weight < 0) throw new Error('El peso no puede ser negativo.');
      if (reps !== null && (reps < 1 || reps > 100)) throw new Error('Las reps deben ser 1-100.');
      if (rir !== null && (rir < 0 || rir > 10)) throw new Error('RIR debe ser 0-10.');
      sets.push({
        set_number: Number(rawSet.set_number || idx + 1),
        weight,
        reps,
        rir,
        note,
      });
      setCount++;
    });

    if (sets.length > 0) {
      const muscleGroup = resolveExerciseMuscleGroup_({
        routine_exercise_id: rexId,
        exercise_name: exerciseName,
        muscle_group: item.muscle_group || (template && template.muscle_group),
      }, exerciseMeta);
      const muscleDistribution = normalizeMuscleDistribution_(
        item.muscleDistribution !== undefined
          ? item.muscleDistribution
          : (item.muscle_distribution !== undefined ? item.muscle_distribution : (template && template.muscle_distribution)),
        muscleGroup,
        exerciseName
      );
      prepared.push({
        routine_exercise_id: rexId,
        exercise_name: exerciseName,
        muscle_group: muscleGroup,
        muscleDistribution,
        muscle_distribution: JSON.stringify(muscleDistribution),
        template,
        sets,
      });
    }
  });

  return { exercises: prepared, setCount };
}

function normalizeOptionalNumber_(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) throw new Error(field + ' inválido.');
  return Math.round(n * 100) / 100;
}

function validateBodyweight_(bodyweight) {
  if (bodyweight !== null && bodyweight <= 0) {
    throw new Error('El peso corporal debe ser mayor a 0.');
  }
}

function normalizeOptionalInteger_(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) throw new Error(field + ' inválido.');
  return Math.round(n);
}

function buildSessionSummary_(session, exercises, routine, day) {
  const allSessions = readAll_(SHEETS.SESSIONS);
  const allSets = readAll_(SHEETS.SETS);
  const exerciseSummaries = exercises.map(ex => {
    const previousSets = getPreviousSetsForExercise_(ex.exercise_name, normalizeDate_(session.date), session.session_id);
    const currentMetrics = calcSetMetrics_(ex.sets);
    const previousMetrics = calcSetMetrics_(previousSets);
    const historicalPrs = getHistoricalPrsForExercise_(ex.exercise_name, session, allSessions, allSets);
    const weightPr = historicalPrs.weight_max > 0 && currentMetrics.weight_max > historicalPrs.weight_max;
    const e1rmPr = historicalPrs.e1rm_max > 0 && currentMetrics.e1rm_max > historicalPrs.e1rm_max;
    const status = compareMetrics_(currentMetrics, previousMetrics, previousSets.length > 0);
    return {
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: ex.exercise_name,
      muscle_group: ex.muscle_group || '',
      muscleDistribution: ex.muscleDistribution || {},
      sets: ex.sets,
      previous_sets: previousSets,
      metrics: currentMetrics,
      previous_metrics: previousSets.length > 0 ? previousMetrics : null,
      historical_prs: historicalPrs,
      is_pr: weightPr || e1rmPr,
      pr_types: {
        weight: weightPr,
        e1rm: e1rmPr,
      },
      status,
      suggestion: buildSuggestion_(ex.sets, ex.template),
    };
  });

  const totalVolume = exerciseSummaries.reduce((sum, ex) => sum + ex.metrics.volume, 0);
  const previousVolume = exerciseSummaries.reduce((sum, ex) => sum + (ex.previous_metrics ? ex.previous_metrics.volume : 0), 0);
  const delta = previousVolume > 0 ? Math.round(((totalVolume - previousVolume) / previousVolume) * 1000) / 10 : null;

  return {
    session_id: session.session_id,
    date: normalizeDate_(session.date),
    routine_id: session.routine_id,
    routine_name: session.routine_name || routine.routine_name || '',
    day_id: session.day_id,
    day_name: session.day_name || day.day_name || '',
    total_volume: Math.round(totalVolume * 100) / 100,
    previous_volume: previousVolume > 0 ? Math.round(previousVolume * 100) / 100 : null,
    delta_percent: delta,
    exercises: exerciseSummaries,
  };
}

function getPreviousSetsForExercise_(exerciseName, beforeDate, excludeSessionId) {
  const nameKey = normalizeExerciseNameKey_(exerciseName);
  if (!nameKey) return [];

  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(s => s.session_id !== excludeSessionId && normalizeDate_(s.date) < beforeDate)
    .sort((a, b) => {
      const dateCmp = normalizeDate_(b.date).localeCompare(normalizeDate_(a.date));
      if (dateCmp !== 0) return dateCmp;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });
  if (!sessions.length) return [];

  const nameByRexId = {};
  readAll_(SHEETS.EXERCISES).forEach(e => {
    if (e.routine_exercise_id && e.exercise_name) {
      nameByRexId[e.routine_exercise_id] = e.exercise_name;
    }
  });

  const sets = readAll_(SHEETS.SETS);
  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i].session_id;
    const found = sets
      .filter(set => set.session_id === sessionId)
      .filter(set => {
        const rawName = set.exercise_name || nameByRexId[set.routine_exercise_id] || '';
        return normalizeExerciseNameKey_(rawName) === nameKey;
      })
      .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
      .map(set => ({
        set_number: Number(set.set_number || 0),
        weight: set.weight === '' ? null : Number(set.weight),
        reps: set.reps === '' ? null : Number(set.reps),
        rir: set.rir === '' ? null : Number(set.rir),
        note: set.note || '',
      }));
    if (found.length > 0) return found;
  }
  return [];
}

function calcSetMetrics_(sets) {
  const clean = (sets || []).filter(s => s.weight !== null || s.reps !== null);
  return clean.reduce((acc, set) => {
    const weight = set.weight === null ? 0 : Number(set.weight);
    const reps = set.reps === null ? 0 : Number(set.reps);
    acc.volume += weight * reps;
    acc.reps_total += reps;
    acc.weight_max = Math.max(acc.weight_max, weight);
    acc.e1rm_max = Math.max(acc.e1rm_max, calcEstimatedOneRepMax_(weight, reps));
    return acc;
  }, { volume: 0, reps_total: 0, weight_max: 0, e1rm_max: 0, set_count: clean.length });
}

function calcEstimatedOneRepMax_(weight, reps) {
  weight = Number(weight || 0);
  reps = Number(reps || 0);
  if (!weight || !reps) return 0;
  return Math.round((weight * (1 + reps / 30)) * 100) / 100;
}

function getHistoricalPrsForExercise_(exerciseName, currentSession, sessions, sets) {
  const currentDate = normalizeDate_(currentSession.date);
  const currentCreated = (currentSession.created_at || '').toString();
  const previousSessionIds = {};
  sessions.forEach(s => {
    if (s.session_id === currentSession.session_id) return;
    const d = normalizeDate_(s.date);
    const created = (s.created_at || '').toString();
    if (d < currentDate || (d === currentDate && created < currentCreated)) {
      previousSessionIds[s.session_id] = true;
    }
  });

  const exerciseSets = sets
    .filter(set => previousSessionIds[set.session_id])
    .filter(set => (set.exercise_name || '').toString().trim() === exerciseName);
  const metrics = calcSetMetrics_(exerciseSets.map(set => ({
    weight: set.weight === '' ? null : Number(set.weight),
    reps: set.reps === '' ? null : Number(set.reps),
  })));

  return {
    weight_max: metrics.weight_max,
    e1rm_max: metrics.e1rm_max,
  };
}

function compareMetrics_(current, previous, hasPrevious) {
  if (!hasPrevious) return 'Sin datos previos';
  if (current.set_count > 0 && previous.set_count === 0) return 'Mejoró';
  if (current.volume > previous.volume && current.weight_max >= previous.weight_max) return 'Mejoró';
  if (current.volume >= previous.volume * 0.95 && current.weight_max >= previous.weight_max) return 'Igual';
  if (current.volume < previous.volume * 0.95) return 'Bajó';
  return 'Igual';
}

function buildSuggestion_(sets, template) {
  if (!template) return 'Registrar una sesión más para afinar la sugerencia.';
  const min = Number(template.target_reps_min || 0);
  const max = Number(template.target_reps_max || 0);
  const reps = (sets || []).map(s => s.reps).filter(r => r !== null);
  if (reps.length === 0) return 'Completá reps para generar una sugerencia.';
  if (max > 0 && reps.every(r => r >= max)) return 'Subir carga próxima vez.';
  if (min > 0 && max > 0 && reps.every(r => r >= min && r <= max)) return 'Mantener carga, cerrar el rango.';
  if (min > 0 && reps.some(r => r < min)) return 'Repetir o bajar; revisar fatiga/técnica.';
  return 'Mantener y buscar reps limpias.';
}

// ============================================================
// HOME STATS API — Parte 6
// ============================================================

function getHomeStats() {
  const today = todayIso_();
  const todayWeekday = getIsoWeekday_(today);
  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const routines = readAll_(SHEETS.ROUTINES);
  const allDays = readAll_(SHEETS.DAYS);
  const allExercises = readAll_(SHEETS.EXERCISES);
  const activeRoutine = routines.find(r => isTrue_(r.is_active));
  const lastSession = sortSessionsDesc_(sessions)[0] || null;

  let exerciseCount = null;
  let setCount = null;
  if (lastSession) {
    const sessionSets = sets.filter(s => s.session_id === lastSession.session_id);
    const exerciseNames = {};
    sessionSets.forEach(s => { if (s.exercise_name) exerciseNames[s.exercise_name] = true; });
    exerciseCount = Object.keys(exerciseNames).length;
    setCount = sessionSets.length;
  }

  const setsBySession = groupBy_(sets, 'session_id');
  const weekActivity = [];
  const weekRange = getWeekRange_(today);
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso_(weekRange.start, i);
    const daySessions = sessions.filter(s => normalizeDate_(s.date) === iso);
    let volume = 0;
    daySessions.forEach(ses => {
      volume += calcRawVolume_(setsBySession[ses.session_id] || []);
    });
    weekActivity.push({
      date: iso,
      weekday: getIsoWeekday_(iso),
      session_count: daySessions.length,
      total_volume: Math.round(volume * 100) / 100,
      is_today: iso === today,
      is_future: iso > today,
    });
  }
  const weekSessionCount = weekActivity.reduce((a, d) => a + d.session_count, 0);
  const weekVolume = Math.round(weekActivity.reduce((a, d) => a + d.total_volume, 0) * 100) / 100;
  const trainedToday = sessions.some(s => normalizeDate_(s.date) === today);

  let todayDay = null;
  if (activeRoutine) {
    const routineDays = allDays
      .filter(d => d.routine_id === activeRoutine.routine_id)
      .sort((a, b) => Number(a.day_order || 0) - Number(b.day_order || 0));
    let chosenDay = routineDays.find(d => parseWeekDays_(d.week_days).indexOf(todayWeekday) >= 0);
    let isScheduledToday = !!chosenDay;
    if (!chosenDay) {
      const scheduled = routineDays.filter(d => parseWeekDays_(d.week_days).length > 0);
      if (scheduled.length) {
        let bestDay = null;
        let bestDist = 99;
        scheduled.forEach(d => {
          parseWeekDays_(d.week_days).forEach(wd => {
            let dist = wd - todayWeekday;
            if (dist <= 0) dist += 7;
            if (dist < bestDist) { bestDist = dist; bestDay = d; }
          });
        });
        chosenDay = bestDay;
      }
    }
    if (!chosenDay && routineDays.length) {
      const lastInRoutine = sortSessionsDesc_(sessions.filter(s => s.routine_id === activeRoutine.routine_id))[0];
      if (lastInRoutine) {
        const idx = routineDays.findIndex(d => d.day_id === lastInRoutine.day_id);
        chosenDay = routineDays[(idx + 1) % routineDays.length];
      } else {
        chosenDay = routineDays[0];
      }
    }
    if (chosenDay) {
      const dayExercises = allExercises
        .filter(e => e.day_id === chosenDay.day_id)
        .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0))
        .map(e => ({
          exercise_name: e.exercise_name,
          target_sets: Number(e.target_sets || 0),
          target_reps_min: Number(e.target_reps_min || 0),
          target_reps_max: Number(e.target_reps_max || 0),
          muscle_group: normalizeMuscleGroup_(e.muscle_group),
        }));
      todayDay = {
        day_id: chosenDay.day_id,
        day_name: chosenDay.day_name,
        is_scheduled_today: isScheduledToday,
        exercises: dayExercises,
      };
    }
  }

  const previousWeekSummary = getPreviousWeekSummary_(sessions, sets, today);
  const recentPr = getMostRecentPr_(sessions, sets);

  return {
    today: today,
    today_weekday: todayWeekday,
    trained_today: trainedToday,
    active_routine: activeRoutine ? {
      routine_id: activeRoutine.routine_id,
      routine_name: activeRoutine.routine_name,
    } : null,
    last_session: lastSession ? {
      session_id: lastSession.session_id,
      date: normalizeDate_(lastSession.date),
      routine_id: lastSession.routine_id,
      routine_name: lastSession.routine_name || '',
      day_id: lastSession.day_id,
      day_name: lastSession.day_name || '',
      exercise_count: exerciseCount,
      set_count: setCount,
    } : null,
    week_activity: weekActivity,
    week_summary: {
      start: weekRange.start,
      end: weekRange.end,
      session_count: weekSessionCount,
      total_volume: weekVolume,
    },
    previous_week_summary: previousWeekSummary,
    recent_pr: recentPr,
    today_day: todayDay,
  };
}

function getWeekActivity(params) {
  params = params || {};
  const requestedOffset = Number(params.offset || 0);
  const offset = isNaN(requestedOffset) ? 0 : Math.min(0, Math.round(requestedOffset));
  const today = todayIso_();
  const weekStart = addDaysIso_(getWeekRange_(today).start, offset * 7);
  const weekRange = getWeekRange_(weekStart);

  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const setsBySession = groupBy_(sets, 'session_id');
  const routinesById = indexBy_(routines, 'routine_id');
  const daysById = indexBy_(days, 'day_id');

  const out = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso_(weekRange.start, i);
    const daySessions = sessions.filter(s => normalizeDate_(s.date) === iso);
    out.push({
      date: iso,
      weekday: getIsoWeekday_(iso),
      is_today: iso === today,
      is_future: iso > today,
      sessions: daySessions.map(session => buildSessionListItem_(
        session,
        setsBySession[session.session_id] || [],
        routinesById[session.routine_id] || {},
        daysById[session.day_id] || {}
      )),
    });
  }

  return { start: weekRange.start, end: weekRange.end, offset, days: out };
}

function getMostRecentPr_(sessions, sets) {
  const setsBySession = groupBy_(sets || [], 'session_id');
  const history = {};
  let mostRecent = null;
  sortSessionsAsc_(sessions || []).forEach(session => {
    const byExercise = {};
    (setsBySession[session.session_id] || []).forEach(set => {
      const name = (set.exercise_name || '').toString().trim();
      if (!name) return;
      if (!byExercise[name]) byExercise[name] = [];
      byExercise[name].push({
        weight: set.weight === '' ? null : Number(set.weight),
        reps: set.reps === '' ? null : Number(set.reps),
      });
    });
    Object.keys(byExercise).forEach(exerciseName => {
      const current = calcSetMetrics_(byExercise[exerciseName]);
      const prev = history[exerciseName] || { weight_max: 0, e1rm_max: 0 };
      let prInfo = null;
      if (prev.weight_max > 0 && current.weight_max > prev.weight_max) {
        prInfo = {
          type: 'weight',
          value: current.weight_max,
          previous: prev.weight_max,
        };
      } else if (prev.e1rm_max > 0 && current.e1rm_max > prev.e1rm_max) {
        prInfo = {
          type: 'e1rm',
          value: Math.round(current.e1rm_max * 10) / 10,
          previous: Math.round(prev.e1rm_max * 10) / 10,
        };
      }
      if (prInfo) {
        mostRecent = {
          date: normalizeDate_(session.date),
          session_id: session.session_id,
          exercise_name: exerciseName,
          type: prInfo.type,
          value: prInfo.value,
          previous: prInfo.previous,
        };
      }
      history[exerciseName] = {
        weight_max: Math.max(prev.weight_max || 0, current.weight_max || 0),
        e1rm_max: Math.max(prev.e1rm_max || 0, current.e1rm_max || 0),
      };
    });
  });
  return mostRecent;
}

function getPreviousWeekSummary_(sessions, sets, todayIso) {
  const currentWeek = getWeekRange_(todayIso);
  const previousWeekStart = addDaysIso_(currentWeek.start, -7);
  const previousWeek = getWeekRange_(previousWeekStart);
  const weekSessions = (sessions || []).filter(session => {
    const date = normalizeDate_(session.date);
    return date >= previousWeek.start && date <= previousWeek.end;
  });
  const weekIds = weekSessions.map(session => session.session_id);
  const weekSets = (sets || []).filter(set => weekIds.indexOf(set.session_id) >= 0);

  return {
    start: previousWeek.start,
    end: previousWeek.end,
    session_count: weekSessions.length,
    total_volume: Math.round(calcRawVolume_(weekSets) * 100) / 100,
    pr_count: countPrsInSessions_(weekSessions, sessions || [], sets || []),
  };
}

function countPrsInSessions_(targetSessions, allSessions, allSets) {
  const targetIds = {};
  (targetSessions || []).forEach(session => {
    if (session && session.session_id) targetIds[session.session_id] = true;
  });
  if (!Object.keys(targetIds).length) return 0;

  const setsBySession = groupBy_(allSets || [], 'session_id');
  const historicalPrsByExercise = {};
  let count = 0;

  sortSessionsAsc_(allSessions || []).forEach(session => {
    const byExercise = {};
    (setsBySession[session.session_id] || []).forEach(set => {
      const name = (set.exercise_name || '').toString().trim();
      if (!name) return;
      if (!byExercise[name]) byExercise[name] = [];
      byExercise[name].push({
        weight: set.weight === '' ? null : Number(set.weight),
        reps: set.reps === '' ? null : Number(set.reps),
      });
    });

    Object.keys(byExercise).forEach(exerciseName => {
      const currentMetrics = calcSetMetrics_(byExercise[exerciseName]);
      const previousPrs = historicalPrsByExercise[exerciseName] || { weight_max: 0, e1rm_max: 0 };
      if (targetIds[session.session_id] && (
        (previousPrs.weight_max > 0 && currentMetrics.weight_max > previousPrs.weight_max) ||
        (previousPrs.e1rm_max > 0 && currentMetrics.e1rm_max > previousPrs.e1rm_max)
      )) {
        count++;
      }

      historicalPrsByExercise[exerciseName] = {
        weight_max: Math.max(previousPrs.weight_max || 0, currentMetrics.weight_max || 0),
        e1rm_max: Math.max(previousPrs.e1rm_max || 0, currentMetrics.e1rm_max || 0),
      };
    });
  });

  return count;
}

function getStreakStatsFromSessions_(sessions, todayIso, targetDays) {
  const target = Math.max(1, Number(targetDays || 3));
  const today = normalizeDate_(todayIso);
  const currentWeek = getWeekRange_(today);
  const weekDaysByStart = {};

  (sessions || []).forEach(session => {
    const date = normalizeDate_(session.date);
    if (date > today) return;
    const week = getWeekRange_(date);
    if (!weekDaysByStart[week.start]) weekDaysByStart[week.start] = {};
    weekDaysByStart[week.start][date] = true;
  });

  const countDays = weekStart => weekDaysByStart[weekStart]
    ? Object.keys(weekDaysByStart[weekStart]).length
    : 0;

  const currentWeekDays = countDays(currentWeek.start);
  let streak = 0;
  let cursor = currentWeek.start;

  if (currentWeekDays >= target) {
    streak = 1;
    cursor = addDaysIso_(cursor, -7);
  } else {
    cursor = addDaysIso_(cursor, -7);
  }

  while (countDays(cursor) >= target) {
    streak++;
    cursor = addDaysIso_(cursor, -7);
  }

  const sessionsNeeded = Math.max(0, target - currentWeekDays);
  return {
    target_days: target,
    current_week_days: currentWeekDays,
    sessions_needed: sessionsNeeded,
    streak_weeks: streak,
    current_week_met: currentWeekDays >= target,
  };
}

function listRecentSessions(params) {
  params = params || {};
  const requestedLimit = Number(params.limit || 20);
  const limit = isNaN(requestedLimit) ? 20 : Math.max(1, Math.min(Math.round(requestedLimit), 500));
  let sessions = readAll_(SHEETS.SESSIONS);
  if (params.days !== undefined && params.days !== null && params.days !== '') {
    const requestedDays = Number(params.days || 91);
    const daysBack = isNaN(requestedDays) ? 91 : Math.max(1, Math.min(Math.round(requestedDays), 366));
    const today = todayIso_();
    const start = addDaysIso_(today, -(daysBack - 1));
    sessions = sessions.filter(session => {
      const date = normalizeDate_(session.date);
      return date >= start && date <= today;
    });
  }
  return buildRecentSessionSummaries_(
    sessions,
    readAll_(SHEETS.SETS),
    readAll_(SHEETS.ROUTINES),
    readAll_(SHEETS.DAYS),
    limit
  );
}

function getHistoryData(params) {
  params = params || {};
  const requestedLimit = Number(params.limit || 500);
  const limit = isNaN(requestedLimit) ? 500 : Math.max(1, Math.min(Math.round(requestedLimit), 500));
  const requestedDays = Number(params.days || 91);
  const daysBack = isNaN(requestedDays) ? 91 : Math.max(1, Math.min(Math.round(requestedDays), 366));
  const today = todayIso_();
  const start = addDaysIso_(today, -(daysBack - 1));
  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(session => {
      const date = normalizeDate_(session.date);
      return date >= start && date <= today;
    });
  const sets = readAll_(SHEETS.SETS);
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const setsBySession = groupBy_(sets, 'session_id');
  const byDate = {};

  sessions.forEach(session => {
    const date = normalizeDate_(session.date);
    if (!byDate[date]) {
      byDate[date] = {
        date,
        session_count: 0,
        total_volume: 0,
        session_ids: [],
      };
    }
    const sessionSets = setsBySession[session.session_id] || [];
    byDate[date].session_count++;
    byDate[date].total_volume += calcRawVolume_(sessionSets);
    byDate[date].session_ids.push(session.session_id);
  });

  return {
    sessions: buildRecentSessionSummaries_(sessions, sets, routines, days, limit),
    activity: {
      start,
      end: today,
      days: Object.keys(byDate)
        .sort()
        .map(date => ({
          date,
          session_count: byDate[date].session_count,
          total_volume: Math.round(byDate[date].total_volume * 100) / 100,
          session_ids: byDate[date].session_ids,
        })),
    },
  };
}

function listSessionDates(params) {
  params = params || {};
  const daysBack = Math.max(30, Math.min(Number(params.days || 180), 366));
  const today = todayIso_();
  const start = addDaysIso_(today, -(daysBack - 1));
  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(s => {
      const d = normalizeDate_(s.date);
      return d >= start && d <= today;
    });
  const setsBySession = groupBy_(readAll_(SHEETS.SETS), 'session_id');
  const byDate = {};

  sessions.forEach(session => {
    const date = normalizeDate_(session.date);
    if (!byDate[date]) {
      byDate[date] = {
        date,
        session_count: 0,
        total_volume: 0,
        session_ids: [],
      };
    }
    const sessionSets = setsBySession[session.session_id] || [];
    byDate[date].session_count++;
    byDate[date].total_volume += calcRawVolume_(sessionSets);
    byDate[date].session_ids.push(session.session_id);
  });

  return {
    start,
    end: today,
    days: Object.keys(byDate)
      .sort()
      .map(date => ({
        date,
        session_count: byDate[date].session_count,
        total_volume: Math.round(byDate[date].total_volume * 100) / 100,
        session_ids: byDate[date].session_ids,
      })),
  };
}

function listBodyweightHistory(params) {
  params = params || {};
  const limit = Math.max(1, Math.min(Number(params.limit || 30), 100));
  return readAll_(SHEETS.SESSIONS)
    .filter(s => s.bodyweight !== '' && s.bodyweight !== null && s.bodyweight !== undefined)
    .map(s => ({
      session_id: s.session_id,
      date: normalizeDate_(s.date),
      created_at: (s.created_at || '').toString(),
      bodyweight: Number(s.bodyweight),
    }))
    .filter(s => !isNaN(s.bodyweight))
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, limit)
    .reverse();
}

function getWeekRange_(isoDate) {
  const date = parseIsoDateLocal_(isoDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return {
    start: formatIsoDateLocal_(new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday)),
    end: formatIsoDateLocal_(new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday + 6)),
  };
}

function parseIsoDateLocal_(iso) {
  const parts = normalizeDate_(iso).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatIsoDateLocal_(date) {
  const yyyy = date.getFullYear();
  const mm = ('0' + (date.getMonth() + 1)).slice(-2);
  const dd = ('0' + date.getDate()).slice(-2);
  return yyyy + '-' + mm + '-' + dd;
}

function addDaysIso_(iso, days) {
  const d = parseIsoDateLocal_(iso);
  d.setDate(d.getDate() + days);
  return formatIsoDateLocal_(d);
}

function calcRawVolume_(sets) {
  return (sets || []).reduce((sum, set) => {
    const w = set.weight === '' || set.weight === null ? 0 : Number(set.weight);
    const r = set.reps === '' || set.reps === null ? 0 : Number(set.reps);
    return sum + (isNaN(w) || isNaN(r) ? 0 : w * r);
  }, 0);
}

function countImprovedLatest_(sessions, sets) {
  const sessionsById = indexBy_(sessions, 'session_id');
  const byExercise = {};
  sets.forEach(set => {
    const rexId = set.routine_exercise_id;
    if (!rexId) return;
    const session = sessionsById[set.session_id];
    if (!session) return;
    if (!byExercise[rexId]) byExercise[rexId] = {};
    if (!byExercise[rexId][session.session_id]) {
      byExercise[rexId][session.session_id] = {
        date: normalizeDate_(session.date),
        created_at: session.created_at || '',
        sets: [],
      };
    }
    byExercise[rexId][session.session_id].sets.push(set);
  });

  let improved = 0;
  Object.keys(byExercise).forEach(rexId => {
    const entries = Object.keys(byExercise[rexId]).map(id => byExercise[rexId][id])
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.created_at.localeCompare(a.created_at);
      });
    if (entries.length < 2) return;
    if (calcRawVolume_(entries[0].sets) > calcRawVolume_(entries[1].sets)) improved++;
  });
  return improved;
}

function getLastSessionSummary_(sessions, sets, routines, days) {
  if (!sessions.length) return null;
  const last = sortSessionsDesc_(sessions)[0];
  if (!last) return null;
  const routinesById = indexBy_(routines, 'routine_id');
  const daysById = indexBy_(days, 'day_id');
  const sessionSets = (sets || []).filter(set => set.session_id === last.session_id);
  return buildSessionListItem_(
    last,
    sessionSets,
    routinesById[last.routine_id] || {},
    daysById[last.day_id] || {}
  );
}

function buildRecentSessionSummaries_(sessions, sets, routines, days, limit) {
  const setsBySession = groupBy_(sets, 'session_id');
  const routinesById = indexBy_(routines, 'routine_id');
  const daysById = indexBy_(days, 'day_id');
  return sortSessionsDesc_(sessions)
    .slice(0, limit)
    .map(session => buildSessionListItem_(
      session,
      setsBySession[session.session_id] || [],
      routinesById[session.routine_id] || {},
      daysById[session.day_id] || {}
    ));
}

function sortSessionsDesc_(sessions) {
  return sessions.slice().sort((a, b) => {
    const dateCmp = normalizeDate_(b.date).localeCompare(normalizeDate_(a.date));
    if (dateCmp !== 0) return dateCmp;
    return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
  });
}

function sortSessionsAsc_(sessions) {
  return sessions.slice().sort((a, b) => {
    const dateCmp = normalizeDate_(a.date).localeCompare(normalizeDate_(b.date));
    if (dateCmp !== 0) return dateCmp;
    return (a.created_at || '').toString().localeCompare((b.created_at || '').toString());
  });
}

function indexBy_(items, field) {
  return (items || []).reduce((acc, item) => {
    const key = item && item[field];
    if (key !== undefined && key !== null && key !== '') acc[key] = item;
    return acc;
  }, {});
}

function indexValues_(items, field) {
  return (items || []).reduce((acc, item) => {
    const key = item && item[field];
    if (key !== undefined && key !== null && key !== '') acc[key] = true;
    return acc;
  }, {});
}

function groupBy_(items, field) {
  return (items || []).reduce((acc, item) => {
    const key = item && item[field];
    if (key === undefined || key === null || key === '') return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function buildSessionListItem_(session, sessionSets, routine, day) {
  return {
    session_id: session.session_id,
    date: normalizeDate_(session.date),
    routine_id: session.routine_id,
    routine_name: session.routine_name || routine.routine_name || '',
    day_id: session.day_id,
    day_name: session.day_name || day.day_name || '',
    volume: Math.round(calcRawVolume_(sessionSets) * 100) / 100,
    set_count: sessionSets.length,
    exercise_count: Object.keys(sessionSets.reduce((acc, set) => {
      acc[set.routine_exercise_id || set.exercise_name] = true;
      return acc;
    }, {})).length,
  };
}

// ============================================================
// PROGRESS API — Parte 7
// ============================================================

function listAllExerciseNames() {
  const names = {};
  readAll_(SHEETS.EXERCISES).forEach(ex => {
    if (ex.exercise_name) names[ex.exercise_name.toString().trim()] = true;
  });
  return Object.keys(names)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getProgressExerciseData(params) {
  params = params || {};
  const exerciseMap = {};
  const exerciseMeta = buildExerciseMuscleMeta_(readAll_(SHEETS.EXERCISES));
  readAll_(SHEETS.EXERCISES).forEach(ex => {
    const name = (ex.exercise_name || '').toString().trim();
    if (!name) return;
    if (!exerciseMap[name]) exerciseMap[name] = resolveExerciseMuscleGroup_(ex, exerciseMeta);
  });
  const exercises = Object.keys(exerciseMap)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, muscle_group: exerciseMap[name] || '' }));
  const names = exercises.map(e => e.name);
  const requested = (params.exercise_name || '').toString().trim();
  const exerciseName = names.indexOf(requested) >= 0 ? requested : (names[0] || '');
  return {
    names,
    exercises,
    selected: exerciseName,
    history: null,
  };
}

function getProgressSummary() {
  const dayExercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(dayExercises);
  const exerciseMap = {};
  const nameById = {};
  dayExercises.forEach(ex => {
    const name = (ex.exercise_name || '').toString().trim();
    if (!name) return;
    if (!exerciseMap[name]) exerciseMap[name] = resolveExerciseMuscleGroup_(ex, exerciseMeta);
    if (ex.routine_exercise_id) nameById[ex.routine_exercise_id] = name;
  });
  const nameByNormalizedKey = {};
  Object.keys(exerciseMap).forEach(name => {
    const key = normalizeExerciseNameKey_(name);
    if (key && !nameByNormalizedKey[key]) nameByNormalizedKey[key] = name;
  });

  const sessions = readAll_(SHEETS.SESSIONS);
  const sessionsById = indexBy_(sessions, 'session_id');
  const sets = readAll_(SHEETS.SETS);

  const byExercise = {};
  sets.forEach(set => {
    const session = sessionsById[set.session_id];
    if (!session) return;
    const setName = (set.exercise_name || '').toString().trim();
    const name = (set.routine_exercise_id && nameById[set.routine_exercise_id])
      || nameByNormalizedKey[normalizeExerciseNameKey_(setName)]
      || null;
    if (!name) return;
    if (!byExercise[name]) byExercise[name] = {};
    const sid = session.session_id;
    if (!byExercise[name][sid]) {
      byExercise[name][sid] = { session_id: sid, date: normalizeDate_(session.date), created_at: session.created_at || '', sets: [] };
    }
    byExercise[name][sid].sets.push({
      weight: set.weight === '' ? null : Number(set.weight),
      reps: set.reps === '' ? null : Number(set.reps),
    });
  });

  const bestOf = (setsArr) => {
    let best = null;
    (setsArr || []).forEach(s => {
      if (s.weight == null) return;
      if (!best || s.weight > best.weight || (s.weight === best.weight && Number(s.reps || 0) > best.reps)) {
        best = { weight: s.weight, reps: Number(s.reps || 0) };
      }
    });
    return best;
  };

  const exercises = Object.keys(exerciseMap).filter(Boolean).map(name => {
    const sessionsMap = byExercise[name] || {};
    const chrono = Object.keys(sessionsMap).map(k => sessionsMap[k]).sort((a, b) => {
      const c = a.date.localeCompare(b.date);
      return c !== 0 ? c : a.created_at.localeCompare(b.created_at);
    });
    const chronoBest = chrono.map(s => bestOf(s.sets)).filter(Boolean);

    let last = null;
    let prev = null;
    let stallCount = 0;
    if (chronoBest.length) {
      let runMax = -Infinity;
      let lastUpIdx = -1;
      chronoBest.forEach((b, idx) => {
        if (b.weight > runMax) { runMax = b.weight; lastUpIdx = idx; }
      });
      last = chronoBest[chronoBest.length - 1];
      if (chronoBest.length > 1) prev = chronoBest[chronoBest.length - 2];
      stallCount = (chronoBest.length - 1) - lastUpIdx;
    }

    return {
      name,
      muscle_group: exerciseMap[name] || '',
      sessions_count: chrono.length,
      last_date: chrono.length ? chrono[chrono.length - 1].date : null,
      last,
      prev,
      stall_count: stallCount,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return { exercises };
}

function listExerciseHistory(params) {
  params = params || {};
  const exerciseName = (params.exercise_name || '').toString().trim();
  const limit = Math.max(1, Math.min(Number(params.limit || 8), 30));
  if (!exerciseName) throw new Error('exercise_name requerido.');

  const exerciseNameKey = normalizeExerciseNameKey_(exerciseName);
  const matchingIds = {};
  readAll_(SHEETS.EXERCISES).forEach(ex => {
    if (!ex.routine_exercise_id) return;
    if ((ex.exercise_name || '').toString().trim() === exerciseName) matchingIds[ex.routine_exercise_id] = true;
  });

  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS)
    .filter(set => (set.routine_exercise_id && matchingIds[set.routine_exercise_id])
      || normalizeExerciseNameKey_(set.exercise_name) === exerciseNameKey);
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const sessionsById = indexBy_(sessions, 'session_id');
  const routinesById = indexBy_(routines, 'routine_id');
  const daysById = indexBy_(days, 'day_id');

  const bySession = {};
  sets.forEach(set => {
    const session = sessionsById[set.session_id];
    if (!session) return;
    if (!bySession[session.session_id]) {
      const routine = routinesById[session.routine_id] || {};
      const day = daysById[session.day_id] || {};
      bySession[session.session_id] = {
        session_id: session.session_id,
        date: normalizeDate_(session.date),
        created_at: session.created_at || '',
        routine_name: routine.routine_name || '',
        day_name: day.day_name || '',
        sets: [],
      };
    }
    bySession[session.session_id].sets.push({
      set_number: Number(set.set_number || 0),
      weight: set.weight === '' ? null : Number(set.weight),
      reps: set.reps === '' ? null : Number(set.reps),
      rir: set.rir === '' ? null : Number(set.rir),
      note: set.note || '',
    });
  });

  const chronological = Object.keys(bySession).map(k => bySession[k])
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    })
    .map(item => {
      item.sets.sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0));
      const metrics = calcSetMetrics_(item.sets);
      item.volume = Math.round(metrics.volume * 100) / 100;
      item.weight_max = metrics.weight_max;
      item.e1rm_max = metrics.e1rm_max;
      item.reps_total = metrics.reps_total;
      return item;
    });

  chronological.forEach((item, idx) => {
    if (idx === 0) {
      item.delta_volume = null;
      item.trend = 'neutral';
      return;
    }
    const prev = chronological[idx - 1];
    item.delta_volume = Math.round((item.volume - prev.volume) * 100) / 100;
    item.delta_e1rm = Math.round((item.e1rm_max - prev.e1rm_max) * 100) / 100;
    item.trend = item.volume > prev.volume ? 'up' : (item.volume < prev.volume ? 'down' : 'flat');
  });

  const recentAsc = chronological.slice(-4);
  let trend = 'Sin datos suficientes';
  if (recentAsc.length >= 2) {
    const first = recentAsc[0].volume;
    const last = recentAsc[recentAsc.length - 1].volume;
    if (last > first) trend = 'Tendencia positiva';
    else if (last < first) trend = 'Tendencia negativa';
    else trend = 'Tendencia estable';
  }

  return {
    exercise_name: exerciseName,
    goal: getExerciseGoal({ exercise_name: exerciseName }),
    trend,
    sessions: chronological.reverse().slice(0, limit),
  };
}

function getExerciseGoal(params) {
  params = params || {};
  const exerciseName = (params.exercise_name || '').toString().trim();
  if (!exerciseName) throw new Error('exercise_name requerido.');
  if (!sheetExists_(SHEETS.GOALS)) return null;
  const goal = readAll_(SHEETS.GOALS)
    .filter(g => (g.exercise_name || '').toString().trim() === exerciseName)
    .sort((a, b) => (b.updated_at || b.created_at || '').toString().localeCompare((a.updated_at || a.created_at || '').toString()))[0];
  if (!goal) return null;
  return {
    goal_id: goal.goal_id,
    exercise_name: goal.exercise_name,
    target_weight: goal.target_weight === '' ? null : Number(goal.target_weight),
    target_1rm: goal.target_1rm === '' ? null : Number(goal.target_1rm),
    created_at: goal.created_at || '',
    updated_at: goal.updated_at || '',
  };
}

function setExerciseGoal(params) {
  params = params || {};
  ensureSheet_(SHEETS.GOALS);
  const exerciseName = (params.exercise_name || '').toString().trim();
  if (!exerciseName) throw new Error('exercise_name requerido.');
  if (exerciseName.length > 100) throw new Error('Nombre demasiado largo (max 100 caracteres).');

  const targetWeight = normalizeGoalTarget_(params.target_weight);
  const target1rm = normalizeGoalTarget_(params.target_1rm);
  const existing = readAll_(SHEETS.GOALS)
    .find(g => (g.exercise_name || '').toString().trim() === exerciseName);

  if (targetWeight === '' && target1rm === '') {
    if (existing) deleteRowById_(SHEETS.GOALS, 'goal_id', existing.goal_id);
    return null;
  }

  if (existing) {
    updateRowById_(SHEETS.GOALS, 'goal_id', existing.goal_id, {
      exercise_name: exerciseName,
      target_weight: targetWeight,
      target_1rm: target1rm,
      updated_at: nowIso_(),
    });
    return getExerciseGoal({ exercise_name: exerciseName });
  }

  appendRow_(SHEETS.GOALS, {
    goal_id: genId_('goal'),
    exercise_name: exerciseName,
    target_weight: targetWeight,
    target_1rm: target1rm,
    created_at: nowIso_(),
    updated_at: nowIso_(),
  });
  return getExerciseGoal({ exercise_name: exerciseName });
}

function normalizeGoalTarget_(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = Number(value);
  if (isNaN(n) || n <= 0) throw new Error('La meta debe ser mayor a 0.');
  return Math.round(n * 100) / 100;
}

function getVolumeByMuscle(params) {
  params = params || {};
  const weeks = Math.max(4, Math.min(Number(params.weeks || 8), 16));
  const today = todayIso_();
  const currentWeek = getWeekRange_(today);
  const start = addDaysIso_(currentWeek.start, -7 * (weeks - 1));
  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const exercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(exercises);
  const sessionsById = {};
  sessions.forEach(session => {
    sessionsById[session.session_id] = session;
  });

  const groups = MUSCLE_GROUPS_.filter(Boolean);
  const subzones = getAllMuscleSubzones_();
  const byWeek = {};
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDaysIso_(start, i * 7);
    byWeek[weekStart] = {
      week_start: weekStart,
      week_end: addDaysIso_(weekStart, 6),
      total_volume: 0,
      direct_sets: 0,
      indirect_sets: 0,
      groups: groups.reduce((acc, group) => {
        acc[group] = 0;
        return acc;
      }, {}),
      direct_groups: groups.reduce((acc, group) => {
        acc[group] = 0;
        return acc;
      }, {}),
      indirect_groups: groups.reduce((acc, group) => {
        acc[group] = 0;
        return acc;
      }, {}),
      subzones: subzones.reduce((acc, subzone) => {
        acc[subzone] = 0;
        return acc;
      }, {}),
      direct_subzones: subzones.reduce((acc, subzone) => {
        acc[subzone] = 0;
        return acc;
      }, {}),
      indirect_subzones: subzones.reduce((acc, subzone) => {
        acc[subzone] = 0;
        return acc;
      }, {}),
    };
  }

  sets.forEach(set => {
    const session = sessionsById[set.session_id];
    if (!session) return;
    const date = normalizeDate_(session.date);
    if (date < start || date > today) return;
    const weekStart = getWeekRange_(date).start;
    if (!byWeek[weekStart]) return;
    const stimuli = getSetMuscleStimuli_(set, exerciseMeta);
    stimuli.forEach(stimulus => {
      const value = Number(stimulus.effective_sets || 0);
      if (value <= 0) return;
      byWeek[weekStart].groups[stimulus.muscle_group] += value;
      byWeek[weekStart].subzones[stimulus.subzone] += value;
      byWeek[weekStart].total_volume += value;
      if (stimulus.direct) {
        byWeek[weekStart].direct_sets += value;
        byWeek[weekStart].direct_groups[stimulus.muscle_group] += value;
        byWeek[weekStart].direct_subzones[stimulus.subzone] += value;
      } else {
        byWeek[weekStart].indirect_sets += value;
        byWeek[weekStart].indirect_groups[stimulus.muscle_group] += value;
        byWeek[weekStart].indirect_subzones[stimulus.subzone] += value;
      }
    });
  });

  const weekItems = Object.keys(byWeek).sort().map(weekStart => {
    const item = byWeek[weekStart];
    groups.forEach(group => {
      item.groups[group] = round2_(item.groups[group]);
      item.direct_groups[group] = round2_(item.direct_groups[group]);
      item.indirect_groups[group] = round2_(item.indirect_groups[group]);
    });
    subzones.forEach(subzone => {
      item.subzones[subzone] = round2_(item.subzones[subzone]);
      item.direct_subzones[subzone] = round2_(item.direct_subzones[subzone]);
      item.indirect_subzones[subzone] = round2_(item.indirect_subzones[subzone]);
    });
    item.total_volume = round2_(item.total_volume);
    item.direct_sets = round2_(item.direct_sets);
    item.indirect_sets = round2_(item.indirect_sets);
    return item;
  });
  const totals = groups.reduce((acc, group) => {
    acc[group] = round2_(weekItems.reduce((sum, week) => sum + Number(week.groups[group] || 0), 0));
    return acc;
  }, {});
  const directTotals = groups.reduce((acc, group) => {
    acc[group] = round2_(weekItems.reduce((sum, week) => sum + Number(week.direct_groups[group] || 0), 0));
    return acc;
  }, {});
  const indirectTotals = groups.reduce((acc, group) => {
    acc[group] = round2_(weekItems.reduce((sum, week) => sum + Number(week.indirect_groups[group] || 0), 0));
    return acc;
  }, {});
  const subzoneTotals = subzones.reduce((acc, subzone) => {
    acc[subzone] = round2_(weekItems.reduce((sum, week) => sum + Number(week.subzones[subzone] || 0), 0));
    return acc;
  }, {});
  const subzoneDirectTotals = subzones.reduce((acc, subzone) => {
    acc[subzone] = round2_(weekItems.reduce((sum, week) => sum + Number(week.direct_subzones[subzone] || 0), 0));
    return acc;
  }, {});
  const subzoneIndirectTotals = subzones.reduce((acc, subzone) => {
    acc[subzone] = round2_(weekItems.reduce((sum, week) => sum + Number(week.indirect_subzones[subzone] || 0), 0));
    return acc;
  }, {});
  const groupDetails = groups.map(group => ({
    muscle_group: group,
    label: MUSCLE_GROUP_LABELS_[group] || group,
    volume: totals[group],
    effective_sets: totals[group],
    direct_sets: directTotals[group],
    indirect_sets: indirectTotals[group],
    subzones: (MUSCLE_GROUP_DEFS_[group] || []).map(subzone => ({
      subzone,
      label: MUSCLE_SUBZONE_LABELS_[subzone] || subzone,
      muscle_group: group,
      volume: subzoneTotals[subzone],
      effective_sets: subzoneTotals[subzone],
      direct_sets: subzoneDirectTotals[subzone],
      indirect_sets: subzoneIndirectTotals[subzone],
    })),
  }));
  const subzoneDetails = subzones.map(subzone => ({
    subzone,
    label: MUSCLE_SUBZONE_LABELS_[subzone] || subzone,
    muscle_group: getMuscleSubzoneGroup_(subzone),
    volume: subzoneTotals[subzone],
    effective_sets: subzoneTotals[subzone],
    direct_sets: subzoneDirectTotals[subzone],
    indirect_sets: subzoneIndirectTotals[subzone],
  }));

  return {
    start,
    end: today,
    metric: 'effective_sets',
    model: getMuscleModelMeta_(),
    groups,
    subzones,
    totals,
    direct_totals: directTotals,
    indirect_totals: indirectTotals,
    subzone_totals: subzoneTotals,
    subzone_direct_totals: subzoneDirectTotals,
    subzone_indirect_totals: subzoneIndirectTotals,
    group_details: groupDetails,
    subzone_details: subzoneDetails,
    insights: buildMuscleVolumeInsights_(groupDetails, subzoneDetails, weeks),
    weeks: weekItems,
  };
}

function getMuscleHeatmap(params) {
  params = params || {};
  const daysBack = Math.max(7, Math.min(Number(params.days || 30), 90));
  const today = todayIso_();
  const start = addDaysIso_(today, -(daysBack - 1));
  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const exercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(exercises);
  const sessionsById = {};
  sessions.forEach(session => {
    sessionsById[session.session_id] = session;
  });

  const groups = MUSCLE_GROUPS_.filter(Boolean);
  const subzones = getAllMuscleSubzones_();
  const stats = groups.reduce((acc, group) => {
    acc[group] = {
      muscle_group: group,
      label: MUSCLE_GROUP_LABELS_[group] || group,
      volume: 0,
      effective_sets: 0,
      direct_sets: 0,
      indirect_sets: 0,
      set_count: 0,
      session_count: 0,
      exercise_count: 0,
    };
    return acc;
  }, {});
  const subzoneStats = subzones.reduce((acc, subzone) => {
    acc[subzone] = {
      subzone,
      label: MUSCLE_SUBZONE_LABELS_[subzone] || subzone,
      muscle_group: getMuscleSubzoneGroup_(subzone),
      volume: 0,
      effective_sets: 0,
      direct_sets: 0,
      indirect_sets: 0,
      set_count: 0,
      session_count: 0,
      exercise_count: 0,
    };
    return acc;
  }, {});
  const sessionSeen = {};
  const exerciseSeen = {};

  sets.forEach(set => {
    const session = sessionsById[set.session_id];
    if (!session) return;
    const date = normalizeDate_(session.date);
    if (date < start || date > today) return;
    const stimuli = getSetMuscleStimuli_(set, exerciseMeta);
    const touchedGroups = {};
    const touchedSubzones = {};
    stimuli.forEach(stimulus => {
      const value = Number(stimulus.effective_sets || 0);
      if (value <= 0) return;
      const group = stimulus.muscle_group;
      stats[group].volume += value;
      stats[group].effective_sets += value;
      subzoneStats[stimulus.subzone].volume += value;
      subzoneStats[stimulus.subzone].effective_sets += value;
      if (stimulus.direct) {
        stats[group].direct_sets += value;
        subzoneStats[stimulus.subzone].direct_sets += value;
      } else {
        stats[group].indirect_sets += value;
        subzoneStats[stimulus.subzone].indirect_sets += value;
      }
      touchedGroups[group] = true;
      touchedSubzones[stimulus.subzone] = true;
    });
    Object.keys(touchedGroups).forEach(group => {
      stats[group].set_count++;
      const sessionKey = group + '|' + set.session_id;
      if (!sessionSeen[sessionKey]) {
        sessionSeen[sessionKey] = true;
        stats[group].session_count++;
      }
      const exerciseKey = group + '|' + (set.routine_exercise_id || set.exercise_name || '');
      if (!exerciseSeen[exerciseKey]) {
        exerciseSeen[exerciseKey] = true;
        stats[group].exercise_count++;
      }
    });
    Object.keys(touchedSubzones).forEach(subzone => {
      subzoneStats[subzone].set_count++;
      const sessionKey = subzone + '|' + set.session_id;
      if (!sessionSeen[sessionKey]) {
        sessionSeen[sessionKey] = true;
        subzoneStats[subzone].session_count++;
      }
      const exerciseKey = subzone + '|' + (set.routine_exercise_id || set.exercise_name || '');
      if (!exerciseSeen[exerciseKey]) {
        exerciseSeen[exerciseKey] = true;
        subzoneStats[subzone].exercise_count++;
      }
    });
  });

  const maxVolume = Math.max.apply(null, groups.map(group => stats[group].volume));
  const maxSubzoneVolume = Math.max.apply(null, subzones.map(subzone => subzoneStats[subzone].volume));
  groups.forEach(group => {
    stats[group].volume = round2_(stats[group].volume);
    stats[group].effective_sets = stats[group].volume;
    stats[group].direct_sets = round2_(stats[group].direct_sets);
    stats[group].indirect_sets = round2_(stats[group].indirect_sets);
    stats[group].intensity = maxVolume > 0 ? round2_(stats[group].volume / maxVolume) : 0;
  });
  subzones.forEach(subzone => {
    subzoneStats[subzone].volume = round2_(subzoneStats[subzone].volume);
    subzoneStats[subzone].effective_sets = subzoneStats[subzone].volume;
    subzoneStats[subzone].direct_sets = round2_(subzoneStats[subzone].direct_sets);
    subzoneStats[subzone].indirect_sets = round2_(subzoneStats[subzone].indirect_sets);
    subzoneStats[subzone].intensity = maxSubzoneVolume > 0 ? round2_(subzoneStats[subzone].volume / maxSubzoneVolume) : 0;
  });

  return {
    start,
    end: today,
    days: daysBack,
    metric: 'effective_sets',
    model: getMuscleModelMeta_(),
    max_volume: round2_(maxVolume),
    max_subzone_volume: round2_(maxSubzoneVolume),
    groups: groups.map(group => stats[group]),
    subzones: subzones.map(subzone => subzoneStats[subzone]),
  };
}

function buildMuscleVolumeInsights_(groupDetails, subzoneDetails, weeks) {
  const insights = [];
  const averageDivisor = Math.max(Number(weeks || 1), 1);
  const bySubzone = {};
  (subzoneDetails || []).forEach(item => { bySubzone[item.subzone] = item; });

  const anterior = bySubzone.deltoide_anterior || {};
  const posterior = bySubzone.deltoide_posterior || {};
  if (Number(anterior.volume || 0) >= 4 && Number(anterior.volume || 0) > Number(posterior.volume || 0) * 1.8) {
    insights.push({
      type: 'imbalance',
      severity: 'warn',
      title: 'Deltoide anterior dominante',
      text: 'El deltoide anterior recibe bastante más estímulo que el posterior. Revisá remos, face pulls o vuelos posteriores.',
      subzones: ['deltoide_anterior', 'deltoide_posterior'],
    });
  }

  (subzoneDetails || []).forEach(item => {
    const direct = Number(item.direct_sets || 0);
    const indirect = Number(item.indirect_sets || 0);
    if (indirect >= 3 && indirect > Math.max(1, direct) * 1.5) {
      insights.push({
        type: 'indirect_excess',
        severity: 'warn',
        title: (item.label || item.subzone) + ' indirecto',
        text: (item.label || item.subzone) + ' acumula más estímulo indirecto que directo.',
        subzones: [item.subzone],
      });
    }
  });

  (groupDetails || []).forEach(group => {
    if (Number(group.volume || 0) <= 0) return;
    const active = (group.subzones || []).filter(sub => Number(sub.volume || 0) > 0);
    const missing = (group.subzones || []).filter(sub => Number(sub.volume || 0) === 0);
    if (active.length >= 2) {
      const sorted = active.slice().sort((a, b) => Number(a.volume || 0) - Number(b.volume || 0));
      const low = sorted[0];
      const high = sorted[sorted.length - 1];
      if (Number(high.volume || 0) >= 4 && Number(low.volume || 0) * 2.2 < Number(high.volume || 0)) {
        insights.push({
          type: 'imbalance',
          severity: 'info',
          title: 'Desequilibrio en ' + (group.label || group.muscle_group),
          text: (low.label || low.subzone) + ' queda muy por debajo de ' + (high.label || high.subzone) + '.',
          muscle_group: group.muscle_group,
          subzones: [low.subzone, high.subzone],
        });
      }
    }
    if (missing.length && Number(group.volume || 0) / averageDivisor >= 3) {
      insights.push({
        type: 'undertrained',
        severity: 'info',
        title: (missing[0].label || missing[0].subzone) + ' sin estímulo',
        text: 'Dentro de ' + (group.label || group.muscle_group) + ', esta porción no recibió series efectivas en el período.',
        muscle_group: group.muscle_group,
        subzones: [missing[0].subzone],
      });
    }
  });

  return insights.slice(0, 4);
}

function listMuscleGroupHistory(params) {
  params = params || {};
  const muscleGroup = normalizeMuscleGroup_(params.muscle_group);
  const limit = Math.max(1, Math.min(Number(params.limit || 8), 30));
  if (!muscleGroup) throw new Error('muscle_group requerido.');

  const sessions = readAll_(SHEETS.SESSIONS);
  const sets = readAll_(SHEETS.SETS);
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const exercises = readAll_(SHEETS.EXERCISES);
  const exerciseMeta = buildExerciseMuscleMeta_(exercises);
  const sessionsById = indexBy_(sessions, 'session_id');
  const routinesById = indexBy_(routines, 'routine_id');
  const daysById = indexBy_(days, 'day_id');

  const bySession = {};
  sets.forEach(set => {
    const groupStimuli = getSetMuscleStimuli_(set, exerciseMeta)
      .filter(stimulus => stimulus.muscle_group === muscleGroup);
    const effectiveSets = groupStimuli.reduce((sum, stimulus) => sum + Number(stimulus.effective_sets || 0), 0);
    if (effectiveSets <= 0) return;

    const session = sessionsById[set.session_id];
    if (!session) return;
    if (!bySession[session.session_id]) {
      const routine = routinesById[session.routine_id] || {};
      const day = daysById[session.day_id] || {};
      bySession[session.session_id] = {
        session_id: session.session_id,
        date: normalizeDate_(session.date),
        created_at: session.created_at || '',
        routine_name: session.routine_name || routine.routine_name || '',
        day_name: session.day_name || day.day_name || '',
        exercises: {},
      };
    }

    const exerciseName = (set.exercise_name || 'Ejercicio').toString().trim();
    if (!bySession[session.session_id].exercises[exerciseName]) {
      bySession[session.session_id].exercises[exerciseName] = [];
    }
    const directSets = groupStimuli
      .filter(stimulus => stimulus.direct)
      .reduce((sum, stimulus) => sum + Number(stimulus.effective_sets || 0), 0);
    const indirectSets = effectiveSets - directSets;
    bySession[session.session_id].exercises[exerciseName].push({
      set_number: Number(set.set_number || 0),
      weight: set.weight === '' ? null : Number(set.weight),
      reps: set.reps === '' ? null : Number(set.reps),
      rir: set.rir === '' ? null : Number(set.rir),
      note: set.note || '',
      effective_sets: round2_(effectiveSets),
      direct_sets: round2_(directSets),
      indirect_sets: round2_(indirectSets),
      subzones: groupStimuli.map(stimulus => ({
        subzone: stimulus.subzone,
        label: MUSCLE_SUBZONE_LABELS_[stimulus.subzone] || stimulus.subzone,
        effective_sets: round2_(stimulus.effective_sets),
        direct: stimulus.direct,
      })),
    });
  });

  const chronological = Object.keys(bySession).map(k => bySession[k])
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    })
    .map(item => {
      const exerciseNames = Object.keys(item.exercises).sort((a, b) => a.localeCompare(b));
      const exerciseSummaries = exerciseNames.map(name => {
        const exerciseSets = item.exercises[name]
          .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0));
        const metrics = calcSetMetrics_(exerciseSets);
        const effectiveSets = round2_(exerciseSets.reduce((sum, set) => sum + Number(set.effective_sets || 0), 0));
        const directSets = round2_(exerciseSets.reduce((sum, set) => sum + Number(set.direct_sets || 0), 0));
        const indirectSets = round2_(exerciseSets.reduce((sum, set) => sum + Number(set.indirect_sets || 0), 0));
        return {
          exercise_name: name,
          sets: exerciseSets,
          volume: effectiveSets,
          effective_sets: effectiveSets,
          direct_sets: directSets,
          indirect_sets: indirectSets,
          weight_max: metrics.weight_max,
          e1rm_max: metrics.e1rm_max,
        };
      });
      const allSets = exerciseSummaries.reduce((acc, ex) => acc.concat(ex.sets), []);
      item.exercises = exerciseSummaries;
      item.volume = round2_(exerciseSummaries.reduce((sum, ex) => sum + Number(ex.effective_sets || 0), 0));
      item.effective_sets = item.volume;
      item.direct_sets = round2_(exerciseSummaries.reduce((sum, ex) => sum + Number(ex.direct_sets || 0), 0));
      item.indirect_sets = round2_(exerciseSummaries.reduce((sum, ex) => sum + Number(ex.indirect_sets || 0), 0));
      item.set_count = allSets.length;
      item.exercise_count = exerciseSummaries.length;
      return item;
    });

  chronological.forEach((item, idx) => {
    if (idx === 0) {
      item.delta_volume = null;
      item.trend = 'neutral';
      return;
    }
    const prev = chronological[idx - 1];
    item.delta_volume = round2_(item.volume - prev.volume);
    item.trend = item.volume > prev.volume ? 'up' : (item.volume < prev.volume ? 'down' : 'flat');
  });

  const recentAsc = chronological.slice(-4);
  let trend = 'Sin datos suficientes';
  if (recentAsc.length >= 2) {
    const first = recentAsc[0].volume;
    const last = recentAsc[recentAsc.length - 1].volume;
    if (last > first) trend = 'Tendencia positiva';
    else if (last < first) trend = 'Tendencia negativa';
    else trend = 'Tendencia estable';
  }

  return {
    muscle_group: muscleGroup,
    label: MUSCLE_GROUP_LABELS_[muscleGroup] || muscleGroup,
    metric: 'effective_sets',
    trend,
    sessions: chronological.reverse().slice(0, limit),
  };
}

function buildExerciseMuscleMeta_(exercises) {
  const result = { byId: {}, byName: {}, distributionById: {}, distributionByName: {} };
  const nameCounts = {};
  const distributionCounts = {};
  (exercises || []).forEach(ex => {
    const group = resolveExerciseMuscleGroup_(ex, null) || safeNormalizeMuscleGroup_(ex.muscle_group);
    if (!group) return;
    const distribution = normalizeMuscleDistribution_(ex.muscle_distribution, group, ex.exercise_name);
    const distributionKey = JSON.stringify(distribution);
    if (ex.routine_exercise_id) result.byId[ex.routine_exercise_id] = group;
    if (ex.routine_exercise_id && Object.keys(distribution).length) result.distributionById[ex.routine_exercise_id] = distribution;
    const nameKey = normalizeExerciseNameKey_(ex.exercise_name);
    if (!nameKey) return;
    if (!nameCounts[nameKey]) nameCounts[nameKey] = {};
    nameCounts[nameKey][group] = (nameCounts[nameKey][group] || 0) + 1;
    if (!distributionCounts[nameKey]) distributionCounts[nameKey] = {};
    distributionCounts[nameKey][distributionKey] = (distributionCounts[nameKey][distributionKey] || 0) + 1;
  });

  Object.keys(nameCounts).forEach(nameKey => {
    result.byName[nameKey] = Object.keys(nameCounts[nameKey])
      .sort((a, b) => nameCounts[nameKey][b] - nameCounts[nameKey][a] || a.localeCompare(b))[0];
  });
  Object.keys(distributionCounts).forEach(nameKey => {
    const distributionKey = Object.keys(distributionCounts[nameKey])
      .sort((a, b) => distributionCounts[nameKey][b] - distributionCounts[nameKey][a] || a.localeCompare(b))[0];
    try {
      result.distributionByName[nameKey] = JSON.parse(distributionKey);
    } catch (err) {
      result.distributionByName[nameKey] = {};
    }
  });
  return result;
}

function resolveExerciseMuscleDistribution_(exercise, exerciseMeta) {
  const direct = parseMuscleDistribution_(exercise && (exercise.muscleDistribution || exercise.muscle_distribution));
  if (Object.keys(direct).length) return direct;
  const byId = exerciseMeta && exercise && exercise.routine_exercise_id
    ? exerciseMeta.distributionById[exercise.routine_exercise_id]
    : null;
  if (byId && Object.keys(byId).length) return byId;
  const nameKey = normalizeExerciseNameKey_(exercise && exercise.exercise_name);
  const byName = exerciseMeta && nameKey ? exerciseMeta.distributionByName[nameKey] : null;
  if (byName && Object.keys(byName).length) return byName;
  const group = resolveExerciseMuscleGroup_(exercise, exerciseMeta);
  return defaultMuscleDistribution_(exercise && exercise.exercise_name, group);
}

function resolveSetMuscleGroup_(set, exerciseMeta) {
  const direct = safeNormalizeMuscleGroup_(set && set.muscle_group);
  if (direct) return direct;
  const byId = exerciseMeta && set && set.routine_exercise_id
    ? exerciseMeta.byId[set.routine_exercise_id]
    : '';
  if (byId) return byId;
  const nameKey = normalizeExerciseNameKey_(set && set.exercise_name);
  const byName = (exerciseMeta && nameKey && exerciseMeta.byName[nameKey]) || '';
  if (byName) return byName;
  return dominantMuscleGroupFromDistribution_(resolveSetMuscleDistribution_(set, exerciseMeta));
}

function resolveSetMuscleDistribution_(set, exerciseMeta) {
  const direct = parseMuscleDistribution_(set && (set.muscleDistribution || set.muscle_distribution));
  if (Object.keys(direct).length) return direct;
  const byId = exerciseMeta && set && set.routine_exercise_id
    ? exerciseMeta.distributionById[set.routine_exercise_id]
    : null;
  if (byId && Object.keys(byId).length) return byId;
  const nameKey = normalizeExerciseNameKey_(set && set.exercise_name);
  const byName = exerciseMeta && nameKey ? exerciseMeta.distributionByName[nameKey] : null;
  if (byName && Object.keys(byName).length) return byName;
  const group = safeNormalizeMuscleGroup_(set && set.muscle_group)
    || (exerciseMeta && set && set.routine_exercise_id ? exerciseMeta.byId[set.routine_exercise_id] : '')
    || (exerciseMeta && nameKey ? exerciseMeta.byName[nameKey] : '');
  return defaultMuscleDistribution_(set && set.exercise_name, group);
}

function getSetMuscleStimuli_(set, exerciseMeta) {
  const distribution = resolveSetMuscleDistribution_(set, exerciseMeta);
  const primaryGroup = resolveSetMuscleGroup_(set, exerciseMeta) || dominantMuscleGroupFromDistribution_(distribution);
  return Object.keys(distribution).map(subzone => {
    const group = getMuscleSubzoneGroup_(subzone);
    const percent = Number(distribution[subzone] || 0);
    return {
      muscle_group: group,
      subzone,
      percent,
      effective_sets: percent / 100,
      direct: group === primaryGroup,
    };
  }).filter(item => item.muscle_group && item.percent > 0);
}

function round2_(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function getMuscleModelMeta_() {
  return {
    groups: MUSCLE_GROUPS_.map(group => ({
      muscle_group: group,
      label: MUSCLE_GROUP_LABELS_[group] || group,
      subzones: (MUSCLE_GROUP_DEFS_[group] || []).map(subzone => ({
        subzone,
        label: MUSCLE_SUBZONE_LABELS_[subzone] || subzone,
      })),
    })),
  };
}

