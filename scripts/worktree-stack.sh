#!/usr/bin/env bash
set -euo pipefail

# Manage an isolated Docker Compose stack for a worktree.
# Runs alongside the prod stack without port conflicts.
# All host ports are offset by +100 from prod defaults.
#
# Usage:
#   scripts/worktree-stack.sh up [branch-name]    # Start the worktree stack
#   scripts/worktree-stack.sh down [branch-name]   # Stop and remove the worktree stack
#   scripts/worktree-stack.sh ps [branch-name]     # Show container status
#   scripts/worktree-stack.sh logs [branch-name]   # Tail logs
#
# If branch-name is omitted, it is inferred from the current git branch.

ACTION="${1:?Usage: worktree-stack.sh <up|down|ps|logs> [branch-name]}"
shift

if [ -n "${1:-}" ]; then
    BRANCH="$1"
else
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

PROJECT="wt-${BRANCH}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Port offsets (+100 from prod defaults)
export POSTGRES_PORT=5539
export STAC_API_PORT=8181
export RASTER_TILER_PORT=8182
export VECTOR_TILER_PORT=8183
export COG_TILER_PORT=8184
export INGESTION_PORT=8186
export FRONTEND_PORT=5285

COMPOSE_CMD=(docker compose -f "$REPO_ROOT/docker-compose.yml" -p "$PROJECT")

case "$ACTION" in
    up)
        echo "Starting worktree stack: $PROJECT (frontend at http://localhost:5285)"
        "${COMPOSE_CMD[@]}" up -d --build
        echo ""
        echo "Worktree stack is running:"
        echo "  Frontend:  http://localhost:5285"
        echo "  Ingestion: http://localhost:8186"
        echo "  Database:  localhost:5539"
        ;;
    down)
        echo "Stopping worktree stack: $PROJECT"
        "${COMPOSE_CMD[@]}" down -v
        ;;
    ps)
        "${COMPOSE_CMD[@]}" ps
        ;;
    logs)
        "${COMPOSE_CMD[@]}" logs -f "$@"
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Usage: worktree-stack.sh <up|down|ps|logs> [branch-name]"
        exit 1
        ;;
esac
