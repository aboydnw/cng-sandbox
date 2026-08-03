#!/usr/bin/env bash
set -euo pipefail

COMPOSE=(docker compose -p cng-smoke)

for attempt in $(seq 1 60); do
    STATUS="$("${COMPOSE[@]}" ps --format json)"
    if STATUS="$STATUS" python3 - <<'PY'
import json
import os
import sys

rows = [json.loads(line) for line in os.environ["STATUS"].splitlines() if line]
expected = {"database", "stac-api", "raster-tiler", "vector-tiler", "cog-tiler", "ingestion", "frontend"}
by_service = {row["Service"]: row for row in rows}
if set(by_service) != expected:
    sys.exit(1)
for service in expected:
    row = by_service[service]
    if row.get("State") != "running" or row.get("Health") not in ("", "healthy"):
        sys.exit(1)
PY
    then
        break
    fi
    if [ "$attempt" = "60" ]; then
        echo "Stack did not become healthy within 10 minutes"
        exit 1
    fi
    sleep 10
done

curl --fail --silent --show-error http://localhost:5185/ >/dev/null
curl --fail --silent --show-error http://localhost:5185/api/health >/dev/null
curl --fail --silent --show-error http://localhost:5185/cog/healthz >/dev/null
curl --fail --silent --show-error http://localhost:5185/raster/healthz >/dev/null
curl --fail --silent --show-error http://localhost:5185/vector/ >/dev/null

echo "Full stack and all browser-facing proxy routes are healthy"
