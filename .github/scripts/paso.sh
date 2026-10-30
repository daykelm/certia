#!/usr/bin/env bash
# Runs a command and, if it fails, publishes its last lines as an error annotation,
# so the cause can be read from the checks tab or the API without opening the full log.
# Usage: .github/scripts/paso.sh "<name>" <command...>
set -uo pipefail

nombre="$1"
shift
salida="$(mktemp)"

"$@" 2>&1 | tee "$salida"
codigo=${PIPESTATUS[0]}

if [ "$codigo" -ne 0 ]; then
  # Strip color codes and encode newlines for the annotation.
  mensaje="$(tail -n 60 "$salida" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  echo "::error title=${nombre}::${mensaje}"
fi
exit "$codigo"
