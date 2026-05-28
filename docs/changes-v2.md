# Cambios v2 - Shym

Estado activo de mejoras planificadas. Se va actualizando a medida que se implementa.

---

## WEB

### Alta prioridad

- [x] **Barra superior tipo notch** — `body::before` ocultado con `display:none` en `@media 900px+`.
- [x] **Logo en sidebar** — `assets/logo.png` clickeable navega al home.
- [x] **Sidebar — reestructura** — orden: LOGO → Entrenar → Nutrición → Progreso → Historial → Rutinas.
- [x] **Home rediseño** *(prioridad #1)* — stats (días sin entrenar, ejercicios, series), CTA de rutina activa con botón Entrenar, tarjeta última sesión clickeable, nutrición de hoy.

### Media prioridad

- [ ] **Preview de ejercicios en rutina** — al ver los días de una rutina, mostrar un preview colapsado de los ejercicios que tiene cada día, sin tener que navegar adentro.

---

## BOTH (Mobile + Web)

### Alta prioridad

- [x] **Sección Nutrición — backend en Google Sheets** — datos persisten en la hoja "Nutrition"; sincroniza entre dispositivos. Se agregaron `getNutritionForDate`, `saveNutritionForDate`, `getNutritionHistory` al API.
- [x] **Sección Nutrición nueva** — pantalla completa con navegación por fecha, registro diario editable y gráfico de historial de calorías (últimos 14 días).
- [x] **Progreso más visual** — gráfico SVG de e1RM + resumen compacto de las últimas 5 sesiones. Auto-carga al entrar (eliminado botón "Cargar").
- [x] **Dropdown de ejercicio en Progreso — agrupado por músculo** — ejercicios agrupados por `<optgroup>` según grupo muscular.

### Media prioridad

- [x] **Sacar Peso corporal de Entrenar** — eliminado el campo al registrar/editar una sesión.
- [x] **Sacar RIR de Entrenar** — eliminado de sets en entrenamiento, edición y vista de detalle.
- [x] **Fix flecha dropdown** — `appearance: none` + flecha SVG custom en todos los `<select>`.
- [x] **Sacar Peso corporal de Progreso** — eliminado el tab "Peso corporal".
- [x] **Agregar agua a Nutrición** — campo "Agua (litros)" en el modal y en la pantalla de nutrición.
- [x] **Fix input decimal en Nutrición** — los inputs aceptan coma (`,`) y se normaliza a punto antes de parsear.

---

## Pendiente

- [ ] **Preview de ejercicios en rutina** — mostrar ejercicios de cada día sin navegar adentro.
- [ ] **Peso corporal en Nutrición** — se guarda pero falta mostrarlo más prominentemente en la pantalla principal.

---

## IMPORTANTE — Pasos de deploy

Después de cada push a este repo, **hay que redesplegar el backend en Google Apps Script**:

1. Abrir el script en apps.google.com/script
2. Deploy > Manage deployments > editar el deployment activo > nueva versión > Deploy
3. La URL /exec no cambia.

Además, **correr `setup()` una vez** si es la primera vez que se agrega la hoja Nutrition (ya existe en HEADERS desde esta versión).
