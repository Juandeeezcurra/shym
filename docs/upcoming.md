# Proximos cambios Shym

Los cambios activos y priorizados están en `changes-v2.md`.

## Items absorbidos en changes-v2

Los siguientes items de esta lista pasaron a `changes-v2.md` con más detalle:

- Adaptación para web (desktop/laptop) — parcialmente implementado; continúa como mejoras de sidebar y home.
- Sección Nutrición — especificación original abajo, ahora activa en changes-v2.

---

## Especificacion original: Nutricion y registro diario

Referencia de campos acordados para la sección de Nutrición:

- **Peso en ayunas** (kg) — movido a Nutrición, sacado de Progreso
- **Calorias consumidas** (kcal)
- **Proteina consumida** (g)
- **Grasas consumidas** (g)
- **Carbohidratos consumidos** (g)
- **Agua tomada** (litros)
- **Entrenamiento**: si / no — puede sincronizarse con sesiones registradas del dia
- **Notas**: hambre, energia, digestion, animo, etc. (texto libre)

Consideraciones:
- Un registro por dia (fecha como clave).
- Permitir edicion del dia actual y dias pasados.
- Vista de historial/progreso: grafico de evolucion de peso, kcal, macros y agua.
- Inputs deben aceptar coma decimal (`,`).
