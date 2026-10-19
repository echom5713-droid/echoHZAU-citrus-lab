#!/usr/bin/env bash
set -euo pipefail
SRC=${1:-}
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Usage: scripts/restore-db.sh <backup.db>" >&2
  exit 1
fi
mkdir -p data
cp "$SRC" data/citrus.db
 echo "Restored $SRC -> data/citrus.db"
