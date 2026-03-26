#!/usr/bin/env bash
# Usage stats for CNG Sandbox — run from the project root or the VM.
# Queries the database for workspace activity, datasets, and stories.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_SERVICE="database"
DB_USER="${POSTGRES_USER:-sandbox}"
DB_NAME="${POSTGRES_DB:-postgis}"

run_sql() {
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" --no-align --tuples-only -c "$1"
}

run_sql_pretty() {
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

echo "=== Workspace Summary ==="
run_sql_pretty "
SELECT
  workspace_id,
  COUNT(*) AS datasets,
  MIN(created_at)::date AS first_upload,
  MAX(created_at)::date AS latest_upload
FROM datasets
GROUP BY workspace_id
ORDER BY latest_upload DESC;
"

echo "=== Story Summary ==="
run_sql_pretty "
SELECT
  workspace_id,
  COUNT(*) AS stories,
  COUNT(*) FILTER (WHERE published) AS published,
  MIN(created_at)::date AS first_created,
  MAX(updated_at)::date AS latest_update
FROM stories
GROUP BY workspace_id
ORDER BY latest_update DESC;
"

echo "=== Overall Totals ==="
run_sql_pretty "
SELECT
  (SELECT COUNT(DISTINCT workspace_id) FROM datasets) AS workspaces_with_data,
  (SELECT COUNT(*) FROM datasets) AS total_datasets,
  (SELECT COUNT(*) FROM stories) AS total_stories,
  (SELECT COUNT(*) FROM stories WHERE published) AS published_stories;
"

echo "=== Recent Activity (last 7 days) ==="
run_sql_pretty "
SELECT
  d.workspace_id,
  d.filename,
  d.dataset_type,
  d.created_at::timestamp(0) AS uploaded
FROM datasets d
WHERE d.created_at > now() - interval '7 days'
ORDER BY d.created_at DESC
LIMIT 20;
"
