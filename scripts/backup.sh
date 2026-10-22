#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
: "${ERP_BACKUP_DIR:?Set a backup directory outside the checkout}"
: "${ERP_BACKUP_RECIPIENT:?Set an age public recipient}"
command -v age >/dev/null
mkdir -p "$ERP_BACKUP_DIR"
backup_path="$ERP_BACKUP_DIR/netfusion-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
backup_tmp="$backup_path.partial"
trap 'rm -f -- "$backup_tmp"' EXIT
docker compose exec -T db pg_dump -U postgres -d erp -Fc | age -r "$ERP_BACKUP_RECIPIENT" > "$backup_tmp"
test -s "$backup_tmp"
mv -- "$backup_tmp" "$backup_path"
printf 'Encrypted backup saved: %s\n' "$backup_path"
