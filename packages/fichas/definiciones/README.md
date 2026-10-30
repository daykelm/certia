# Definiciones de fichas

Cada archivo YAML define **una versión** de una ficha y debe cumplir el esquema de `packages/core/src/ficha/schema.ts`.

Reglas:

- Una carpeta por ficha y un archivo por versión: `<ficha>/v<N>.yaml`.
- **Una versión publicada no se modifica.** Un cambio normativo crea un archivo nuevo con la versión siguiente.
- Cada versión incluye al menos un caso de prueba de cálculo.
- `pnpm fichas:check` valida todas las fichas y ejecuta sus pruebas; CI lo exige para desplegar.

> ⚠️ Las fichas de vehículo eléctrico incluidas son **plantillas de ejemplo**: el código, los factores, la fórmula y los documentos son ilustrativos. Deben sustituirse por los de la ficha oficial del catálogo del Ministerio antes de usarse con expedientes reales.
