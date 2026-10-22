#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ERP_BACKUP_FILE:?Set the encrypted backup file}"
: "${ERP_BACKUP_IDENTITY:?Set the age private-key file path}"
command -v age >/dev/null
restore_database="erp_restore_$(date -u +%Y%m%d%H%M%S)"
docker compose exec -T db createdb -U postgres "$restore_database"
age -d -i "$ERP_BACKUP_IDENTITY" "$ERP_BACKUP_FILE" | docker compose exec -T db pg_restore -U postgres --dbname "$restore_database" --exit-on-error
docker compose exec -T db psql -U postgres -d "$restore_database" -v ON_ERROR_STOP=1 -c 'SELECT (SELECT count(*) FROM tickets) AS tickets,(SELECT count(*) FROM service_cases) AS service_cases,(SELECT count(*) FROM document_relations) AS relations,(SELECT count(*) FROM audit_events) AS audit_events;'
printf 'Restored into isolated database %s. Verify business counts before manually removing it.\n' "$restore_database"
