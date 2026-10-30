#!/usr/bin/env bash
# Ejecuta un comando y, si falla, publica sus últimas líneas como anotación de error,
# para poder leer el motivo desde la pestaña de checks o la API sin abrir el log completo.
# Uso: .github/scripts/paso.sh "<nombre>" <comando...>
set -uo pipefail

nombre="$1"
shift
salida="$(mktemp)"

"$@" 2>&1 | tee "$salida"
codigo=${PIPESTATUS[0]}

if [ "$codigo" -ne 0 ]; then
  # Se quitan códigos de color y se codifican los saltos de línea para la anotación.
  mensaje="$(tail -n 60 "$salida" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  echo "::error title=${nombre}::${mensaje}"
fi
exit "$codigo"
