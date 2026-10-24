#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3 is required to run the native lifecycle controller.' >&2
  exit 1
fi
exec python3 "$project_root/tools/libretranslate/native.py" models "$@"
