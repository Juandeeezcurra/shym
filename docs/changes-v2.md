# Cambios v2 - Shym

Estado activo de mejoras planificadas. Se va actualizando a medida que se implementa.

---

## WEB

### Alta prioridad

- [x] **Barra superior tipo notch** — eliminado el `body::before` que agregaba una barra mínima de 24px en desktop.
- [x] **Logo en sidebar** — reemplazado el punto + texto "Shym" por `assets/logo.png`. El logo navega al home al hacer clic.
- [x] **Sidebar — reestructura** — nuevo orden: LOGO → Entrenar → Nutrición → Progreso → Historial.
- [x] **Home rediseño** *(prioridad #1)* — quitado "Inicio rápido". El home muestra: stats (días sin entrenar, ejercicios y series de última sesión), tarjeta de última sesión clickeable, y nutrición de hoy.

### Media prioridad

- [ ] **Preview de ejercicios en rutina** — al ver los días de una rutina, mostrar un preview colapsado de los ejercicios que tiene cada día, sin tener que navegar adentro.

---

## BOTH (Mobile + Web)

### Alta prioridad

- [x] **Sección Nutrición nueva** — pantalla completa con navegación por fecha, registro diario editable y gráfico de historial de calorías (últimos 14 días).
- [x] **Progreso más visual** — reemplazada la lista de tarjetas por sesión con un gráfico SVG de e1RM + resumen compacto de las últimas 5 sesiones.
- [x] **Dropdown de ejercicio en Progreso — agrupado por músculo** — ejercicios agrupados por `<optgroup>` según grupo muscular. Eliminados los tabs de filtro "Ejercicio / Músculo".

### Media prioridad

- [x] **Sacar Peso corporal de Entrenar** — eliminado el campo al registrar/editar una sesión.
- [x] **Sacar RIR de Entrenar** — eliminado de sets en entrenamiento, edición y vista de detalle.
- [x] **Fix flecha dropdown en Entrenar y Progreso** — agregado `padding-right: 38px` a todos los `<select>`.
- [x] **Sacar Peso corporal de Progreso** — eliminado el tab "Peso corporal" de las tabs de progreso.
- [x] **Agregar agua a Nutrición** — campo "Agua (litros)" en el modal y en la pantalla de nutrición.
- [x] **Fix input decimal en Nutrición** — los inputs aceptan coma (`,`) y se normaliza a punto antes de parsear.

---

## Pendiente

- [ ] **Preview de ejercicios en rutina** — mostrar ejercicios de cada día sin navegar adentro.
- [ ] **Peso corporal en Nutrición** — ya se guarda en nutrición pero falta mostrarlo en la pantalla principal de nutrición de forma prominente.
