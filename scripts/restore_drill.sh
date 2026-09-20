#!/usr/bin/env bash
# Restore drill — proves your backup actually restores, WITHOUT touching prod.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/pujafinder" ./scripts/restore_drill.sh [backup.dump]
#
# What it does:
#   1. pg_dump your live DB (or use the dump file you pass in)
#   2. restore into a SCRATCH database "pujafinder_restore_drill" (dropped first)
#   3. compare row counts live vs restored
#   4. drop the scratch DB
#
# Run this at least once before launch, and after any big change.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your PostgreSQL connection string}"
DUMP_FILE="${1:-}"

PSQL="psql ${DATABASE_URL}"
DBNAME=$($PSQL -t -c "SELECT current_database();" | tr -d ' \n')
SCRATCH="${DBNAME}_restore_drill"
ADMIN_URL="${DATABASE_URL%/*}/postgres"

echo "[1/5] dumping live database '$DBNAME'..."
if [ -n "$DUMP_FILE" ]; then
  cp "$DUMP_FILE" /tmp/restore_drill.dump
else
  pg_dump --format=custom --file /tmp/restore_drill.dump "$DATABASE_URL"
fi
ls -lh /tmp/restore_drill.dump

echo "[2/5] preparing scratch database '$SCRATCH'..."
$PSQL -q -c "SELECT 1 FROM pg_database WHERE datname='$SCRATCH'" | grep -q 1 && $PSQL -q -c "DROP DATABASE $SCRATCH;"
psql "$ADMIN_URL" -q -c "CREATE DATABASE $SCRATCH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';"

echo "[3/5] restoring into scratch..."
pg_restore --no-owner --dbname "$DATABASE_URL%/${SCRATCH}" /tmp/restore_drill.dump 2>/dev/null \
  || pg_restore --no-owner --dbname "${DATABASE_URL%/*}/$SCRATCH" /tmp/restore_drill.dump

echo "[4/5] comparing row counts (live vs restored)..."
TABLES="pandals users reviews crowd_reports moments events content_blocks"
FAIL=0
for t in $TABLES; do
  LIVE=$($PSQL -t -c "SELECT count(*) FROM $t" | tr -d ' \n') || LIVE="?"
  RESTORED=$(psql "${DATABASE_URL%/*}/$SCRATCH" -t -c "SELECT count(*) FROM $t" | tr -d ' \n') || RESTORED="?"
  if [ "$LIVE" = "$RESTORED" ]; then
    echo "  ok   $t: $LIVE"
  else
    echo "  FAIL $t: live=$LIVE restored=$RESTORED"; FAIL=1
  fi
done

echo "[5/5] dropping scratch database..."
psql "$ADMIN_URL" -q -c "DROP DATABASE $SCRATCH;"

if [ "$FAIL" = "0" ]; then
  echo "✅ RESTORE DRILL PASSED — your backups are real."
else
  echo "❌ DRILL FAILED — investigate before launch!"
  exit 1
fi
