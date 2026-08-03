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

probe() {
    local url="$1"
    curl --fail --silent --show-error \
        --retry 12 --retry-all-errors --retry-delay 5 \
        "$url" >/dev/null
}

# The frontend has no Compose healthcheck, so its container can be running a
# few seconds before Vite and its proxies begin accepting connections.
probe http://localhost:5185/
probe http://localhost:5185/api/health
probe http://localhost:5185/cog/healthz
probe http://localhost:5185/raster/healthz
probe http://localhost:5185/vector/

echo "Full stack and all browser-facing proxy routes are healthy"
