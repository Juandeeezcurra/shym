# Shym Project Memory

Esta es la biblia corta del proyecto. Si algo contradice esto, confiar primero en este archivo y despues verificar el codigo.

## Arquitectura Canonica

- La app es **frontend estatico en GitHub Pages + backend API en Google Apps Script**.
- El usuario abre la app en: `https://juandeeezcurra.github.io/shym/`.
- El frontend canonical es `index.html` en la raiz del repo. Debe estar en lowercase para GitHub Pages.
- No usar `Index.html` como archivo canonical. No volver a depender de Apps Script HtmlService.
- Apps Script contiene **solo `Code.gs`**.
- `Code.gs` expone API JSON por `doPost(e)`.
- El frontend llama al backend con `fetch` a la URL del Web App que termina en `/exec`.
- La URL del backend se guarda en `localStorage` con key `gymtracker:backend-url`.
- `google.script.run` esta prohibido en este proyecto. Si aparece, es una regresion.
- `HtmlService.createTemplateFromFile('Index')` esta prohibido en este proyecto. Si aparece, es una regresion.

## Deploy Correcto

### Frontend

- Cambios en `index.html` se pushean a GitHub.
- GitHub Pages sirve el HTML automaticamente.
- Si el navegador no ve cambios: hard refresh. En iPhone puede requerir limpiar cache de Safari.

### Backend

Cada vez que cambia `Code.gs`:

1. Copiar `Code.gs` desde GitHub raw.
2. Pegar en Apps Script, reemplazando todo el contenido.
3. Guardar.
4. Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy.
5. Configuracion del Web App:
   - Execute as: `Me`
   - Access: `Anyone`
6. Copiar la URL que termina en `/exec`.
7. En la app de GitHub Pages, pegar esa URL en la pantalla "Configurar backend".

No pegar `index.html` en Apps Script. Eso fue el error que mezclo arquitecturas.

## Contrato API

El frontend manda:

```js
fetch(BACKEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ fn: 'nombreFuncion', args: [...] })
})
```

El backend responde:

```json
{ "ok": true, "result": {} }
```

o:

```json
{ "ok": false, "error": "mensaje" }
```

Funciones permitidas viven en `getApi_()` dentro de `Code.gs`. Si se agrega un endpoint publico, agregarlo ahi.

## Data Model

Sheets:

- `Routines`: `routine_id`, `routine_name`, `created_at`, `is_active`
- `Routine_Days`: `day_id`, `routine_id`, `day_name`, `day_order`
- `Day_Exercises`: `routine_exercise_id`, `day_id`, `exercise_order`, `exercise_name`, `target_sets`, `target_reps_min`, `target_reps_max`, `suggested_weight`, `technique_note`
- `Sessions`: `session_id`, `date`, `routine_id`, `day_id`, `bodyweight`, `notes`, `created_at`
- `Session_Sets`: `set_id`, `session_id`, `routine_exercise_id`, `exercise_name`, `set_number`, `weight`, `reps`, `rir`, `note`

Pesos persistidos siempre en kg. El toggle kg/lb es display/input solamente.

## Estado Actual

- Parte 1 completa: setup, sheets y helpers.
- Parte 2 completa: rutinas CRUD.
- Parte 3 completa: dias y ejercicios CRUD.
- Parte 4 base completa: seleccion de entrenamiento, pantalla train, autosave, kg/lb, series extras, precarga de ultima vez.
- Parte 5 base completa: guardar sesion real, resumen, detalle, edicion y borrado completos.
- Parte 6 iniciada: Home stats reales y ultima sesion clickeable completos.
- Parte 7 base completa: progreso por ejercicio con selector, historial, volumen, delta y tendencia simple.
- Reorder completo: dias y ejercicios tienen flechas arriba/abajo y endpoints `reorderDay` / `reorderExercise`.
- App icon/manifest completo: iconos PNG en `assets/`, `manifest.webmanifest` y tags PWA basicos en `index.html`.
- UX/nav inicial completo: train-pick ajustado para iPhone, bottom nav de 5 items con CTA central, pantalla `screen-history` y endpoint `listRecentSessions`.
- Home ya no muestra volumen semanal. Progreso muestra `Último máx.` del ejercicio en vez de volumen total como metrica principal.
- Modal de ejercicio tiene autocomplete por `listAllExerciseNames()` e inputs numericos optimizados para iPhone.
- Lista de pendientes viva: `docs/pending.md`. Leerla antes de decidir el siguiente bloque.

## Prioridades Actuales

Segun `docs/pending.md` actualizado el 2026-05-02:

1. Primero arreglar UX chica sin schema:
   - definir metricas finales de las cards del Home;
   - evaluar si el Historial necesita filtros o calendario visual.
2. Despues features de analitica sin schema:
   - 1RM estimado;
   - PRs automaticos calculados desde `Session_Sets`;
   - calendario de sesiones;
   - evolucion de peso corporal.
3. Mas adelante features con schema/migracion:
   - `muscle_group` en ejercicios;
   - volumen por grupo muscular;
   - calendario semanal por dia de rutina;
   - goals;
   - duracion de sesion.

No implementar features grandes de schema sin avisar que requieren actualizar `Code.gs`, correr/ajustar `setup()` o migrar columnas existentes en Sheets, y redeployar Apps Script.

## Reglas de Implementacion

- Mantener estilo mobile-first dark premium.
- No usar tablas visibles.
- Mutaciones de rutina/dia/ejercicio deben devolver la rutina completa cuando eso evita un roundtrip.
- Orden de dias y ejercicios por `*_order`, sin drag-and-drop por ahora.
- Sets vacios se ignoran al guardar sesion.
- Al guardar sesion exitosamente, borrar draft `gymtracker:session-draft:<day_id>:<date>`.
- Si cambia `Code.gs`, avisar que hay que redeployar Apps Script.
- Si cambia `index.html`, avisar que hay que pushear y refrescar GitHub Pages.
- Si cambia `manifest.webmanifest` o assets de icono, avisar que GitHub Pages puede cachear y que iOS puede requerir quitar/agregar de nuevo a Home Screen.

## Señales De Problema

- Error `google.script.run is not defined`: el frontend volvio a depender de Apps Script. Corregir a `fetch`.
- Error `No se encontró el archivo HTML llamado Index`: alguien esta intentando servir HTML desde Apps Script. No corresponde.
- La URL `/exec` abierta directo muestra JSON: eso esta bien. La app se abre desde GitHub Pages.
- La app no conecta al backend: revisar URL `/exec`, deploy nueva version, permisos `Anyone`, y que `Code.gs` tenga `doPost`.
