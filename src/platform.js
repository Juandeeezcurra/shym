// ============================================================
// SHYM — CAPA DE PLATAFORMA
// ============================================================
// Reemplaza a Utilities / Session / PropertiesService de Apps Script.
// ============================================================

// Apps Script resolvia la zona con Session.getScriptTimeZone(). Los Workers
// corren SIEMPRE en UTC, asi que sin esto un entrenamiento cargado 22h en
// Buenos Aires se guardaria con la fecha del dia siguiente, y eso corre la
// racha, el calendario de actividad y el resumen semanal.
// Se puede sobreescribir con la var TZ en wrangler.toml.
export let TZ = 'America/Argentina/Buenos_Aires';

export function setTimezone(tz) {
  if (tz) TZ = tz;
}

const dateFmtCache = {};
function dateFmt() {
  if (!dateFmtCache[TZ]) {
    dateFmtCache[TZ] = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  return dateFmtCache[TZ];
}

// Equivale a Utilities.formatDate(date, tz, 'yyyy-MM-dd').
// en-CA ya formatea como YYYY-MM-DD.
export function formatDateIso(date) {
  return dateFmt().format(date);
}

export function nowIso_() {
  return new Date().toISOString();
}

export function todayIso_() {
  return formatDateIso(new Date());
}

// Equivale a Utilities.getUuid().
export function genId_(prefix) {
  return prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export function isTrue_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}
