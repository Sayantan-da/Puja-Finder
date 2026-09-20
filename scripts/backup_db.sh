#!/usr/bin/env bash
# Nightly PostgreSQL backup (run from cron on any machine with pg_dump):
#   crontab entry (02:17 daily, keeps 7 days):
#     17 2 * * * DATABASE_URL="postgresql://user:pass@host/db" /path/to/scripts/backup_db.sh >> /var/log/pujafinder_backup.log 2>&1
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your PostgreSQL connection string}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --file "$BACKUP_DIR/pujafinder_${STAMP}.dump" "$DATABASE_URL"
echo "[$(date -Is)] wrote $BACKUP_DIR/pujafinder_${STAMP}.dump"

# Rotate old backups
find "$BACKUP_DIR" -name 'pujafinder_*.dump' -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date -Is)] rotated backups older than ${RETAIN_DAYS} days"

# Restore with:
#   pg_restore --clean --if-exists --dbname "$DATABASE_URL" backups/pujafinder_YYYYMMDD_HHMMSS.dump
