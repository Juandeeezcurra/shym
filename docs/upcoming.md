# Proximos cambios Shym

## Prioridad alta

### 1. Adaptar la app para web (desktop / laptop)
- Actualmente la app se ve muy rara en laptop: el layout esta optimizado solo para mobile.
- Objetivo: que la UI sea usable y prolija en pantallas anchas, sin romper la experiencia mobile existente.
- Puntos a revisar:
  - Ancho maximo del contenedor principal (evitar que todo se estire de borde a borde).
  - Tipografia y espaciados en resoluciones >= 1024px.
  - Navegacion inferior: decidir si se mantiene como bottom-bar o se mueve a una sidebar/topbar en desktop.
  - Heatmap corporal y tarjetas: revisar proporciones en pantalla ancha.
  - Tests visuales en al menos: laptop 13", monitor 1440p, tablet horizontal.

## Nueva seccion: Nutricion y registro diario

Agregar una seccion dedicada a tracking de nutricion y estado corporal/diario.

### Campos del registro diario
- **Peso en ayunas** (kg)
- **Calorias consumidas** (kcal)
- **Proteina consumida** (g)
- **Grasas consumidas** (g)
- **Carbohidratos consumidos** (g)
- **Entrenamiento**: si / no (boolean)
- **Pasos o actividad**: opcional (numero / texto libre)
- **Notas**: hambre, energia, digestion, animo, etc. (texto libre)

### Consideraciones de diseno
- Un registro por dia (fecha como clave).
- Permitir edicion del dia actual y dias pasados.
- Vista de historial: lista o calendario con resumen rapido (peso, kcal, macros).
- Posibles graficos a futuro: evolucion de peso, kcal promedio, distribucion de macros.
- Integracion con el resto de la app: el flag de entrenamiento del dia podria sincronizarse con sesiones registradas.
