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
    echo "Probing $url"
    curl --fail --silent --show-error \
        --retry 12 --retry-all-errors --retry-delay 5 \
        "$url" >/dev/null
}

probe_reachable() {
    local url="$1"
    local status
    echo "Probing $url (any non-5xx response)"
    for attempt in $(seq 1 12); do
        status=$(curl --silent --show-error --output /dev/null \
            --write-out "%{http_code}" "$url") || status=000
        if [ "$status" -ge 200 ] && [ "$status" -lt 500 ]; then
            return 0
        fi
        echo "Attempt $attempt/12 returned HTTP $status"
        [ "$attempt" = "12" ] || sleep 5
    done
    return 1
}

# The frontend has no Compose healthcheck, so its container can be running a
# few seconds before Vite and its proxies begin accepting connections.
probe http://localhost:5185/
probe http://localhost:5185/api/health
# The COG proxy intentionally preserves /cog, but the service-level health
# endpoint lives at /healthz. Its 404 here proves Vite reached the upstream;
# a proxy or service failure returns 5xx instead.
probe_reachable http://localhost:5185/cog/healthz
probe http://localhost:5185/raster/healthz
probe http://localhost:5185/vector/

echo "Full stack and all browser-facing proxy routes are healthy"
