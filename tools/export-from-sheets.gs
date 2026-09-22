// ============================================================
// SHYM — EXPORT DE SHEETS (paso unico de migracion)
// ============================================================
// Pega esto AL FINAL de Code.gs en Apps Script, guarda, redeploya una ultima
// vez y llama al endpoint. Devuelve todas las filas crudas de las 8 sheets,
// mas los valores de PropertiesService, en un solo JSON.
//
//   curl -s -X POST "<URL>/exec" \
//     -H 'Content-Type: text/plain;charset=utf-8' \
//     -d '{"fn":"exportAll","args":[]}' > shym-export.json
//
// Para que el endpoint sea invocable hay que agregar `exportAll,` a getApi_().
// ============================================================

function exportAll() {
  var out = { exported_at: nowIso_(), timezone: Session.getScriptTimeZone(), tables: {}, settings: {} };

  Object.keys(HEADERS).forEach(function (name) {
    if (!sheetExists_(name)) { out.tables[name] = []; return; }
    var sh = getSheet_(name);
    var lastRow = sh.getLastRow();
    var headers = HEADERS[name];
    if (lastRow < 2) { out.tables[name] = []; return; }
    var values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
    out.tables[name] = values
      .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
      .map(function (row) {
        var obj = {};
        headers.forEach(function (h, i) {
          var v = row[i];
          // Las fechas vuelven como Date de Sheets: se normalizan a ISO para
          // que el import no dependa de la zona horaria del importador.
          if (Object.prototype.toString.call(v) === '[object Date]') {
            v = Utilities.formatDate(v, Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd');
          }
          obj[h] = v;
        });
        return obj;
      });
  });

  var props = PropertiesService.getScriptProperties().getProperties();
  if (props && props.nutrition_target_kcal) {
    out.settings.nutrition_target_kcal = props.nutrition_target_kcal;
  }

  var counts = {};
  Object.keys(out.tables).forEach(function (k) { counts[k] = out.tables[k].length; });
  out.counts = counts;
  return out;
}
