#!/usr/bin/env bash
# Runs a command and, if it fails, publishes its last lines as an error annotation,
# so the cause can be read from the checks tab or the API without opening the full log.
# Usage: .github/scripts/step.sh "<name>" <command...>
set -uo pipefail

name="$1"
shift
output="$(mktemp)"

"$@" 2>&1 | tee "$output"
code=${PIPESTATUS[0]}

if [ "$code" -ne 0 ]; then
  # Strip color codes and encode newlines for the annotation.
  message="$(tail -n 60 "$output" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  echo "::error title=${name}::${message}"
fi
exit "$code"
