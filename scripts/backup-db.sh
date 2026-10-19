#!/usr/bin/env bash
set -euo pipefail
mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)
if [ -f data/citrus.db ]; then
  cp data/citrus.db "backups/citrus-$TS.db"
  echo "Backup created: backups/citrus-$TS.db"
else
  echo "data/citrus.db not found; backup skipped" >&2
fi
