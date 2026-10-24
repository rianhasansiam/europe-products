#!/usr/bin/env bash
set -euo pipefail
: "${VPS_SSH_TARGET:?Set VPS_SSH_TARGET to your SSH user@host}"
TASK_SEXTOY_DB_PORT="${VPS_DB_LOCAL_PORT:-15434}"
if [[ ! "$TASK_SEXTOY_DB_PORT" =~ ^[0-9]+$ ]] || (( TASK_SEXTOY_DB_PORT < 1024 || TASK_SEXTOY_DB_PORT > 65535 )); then
  echo 'VPS_DB_LOCAL_PORT must be a port between 1024 and 65535.' >&2
  exit 1
fi
exec ssh -fNT -L "127.0.0.1:${TASK_SEXTOY_DB_PORT}:127.0.0.1:5432" \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 "$VPS_SSH_TARGET"
