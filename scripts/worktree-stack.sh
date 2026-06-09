#!/usr/bin/env bash
set -euo pipefail

# Manage an isolated Docker Compose stack for a worktree.
# Runs alongside the prod stack without port conflicts.
# All host ports are offset by +100 from prod defaults.
#
# Usage:
#   scripts/worktree-stack.sh up [--branch <name>]              # Start the worktree stack
#   scripts/worktree-stack.sh down [--branch <name>]            # Stop and remove the worktree stack
#   scripts/worktree-stack.sh ps [--branch <name>]              # Show container status
#   scripts/worktree-stack.sh logs [--branch <name>] [service]  # Tail logs
#
# The branch defaults to the current git branch; pass --branch (or -b) to
# override. Any remaining arguments are passed through to docker compose
# (e.g. a service name for `logs`).

usage() {
    echo "Usage: worktree-stack.sh <up|down|ps|logs> [--branch <name>] [compose-args...]"
}

ACTION="${1:-}"
case "$ACTION" in
    up|down|ps|logs) ;;
    -h|--help|"")
        usage
        exit 0
        ;;
    *)
        echo "Unknown action: $ACTION"
        usage
        exit 1
        ;;
esac
shift

BRANCH=""
ARGS=()
while [ $# -gt 0 ]; do
    case "$1" in
        -b|--branch)
            BRANCH="${2:?--branch requires a value}"
            shift 2
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

if [ -z "$BRANCH" ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

# Compose project names must be lowercase [a-z0-9_-]; branch names like
# feat/foo would otherwise produce an invalid project name.
SANITIZED="$(printf '%s' "$BRANCH" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '-')"

PROJECT="wt-${SANITIZED}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Port offsets (+100 from prod defaults)
export POSTGRES_PORT=5539
export STAC_API_PORT=8181
export RASTER_TILER_PORT=8182
export VECTOR_TILER_PORT=8183
export COG_TILER_PORT=8184
export INGESTION_PORT=8186
export FRONTEND_PORT=5285

# Tag worktree builds separately so `up --build` never overwrites the prod
# `latest` image on the shared Docker daemon.
export IMAGE_TAG="wt-${SANITIZED}"

COMPOSE_CMD=(docker compose -f "$REPO_ROOT/docker-compose.yml" -p "$PROJECT")

case "$ACTION" in
    up)
        echo "Starting worktree stack: $PROJECT (frontend at http://localhost:5285)"
        "${COMPOSE_CMD[@]}" up -d --build ${ARGS[@]+"${ARGS[@]}"}
        echo ""
        echo "Worktree stack is running:"
        echo "  Frontend:  http://localhost:5285"
        echo "  Ingestion: http://localhost:8186"
        echo "  Database:  localhost:5539"
        ;;
    down)
        echo "Stopping worktree stack: $PROJECT"
        "${COMPOSE_CMD[@]}" down -v ${ARGS[@]+"${ARGS[@]}"}
        ;;
    ps)
        "${COMPOSE_CMD[@]}" ps ${ARGS[@]+"${ARGS[@]}"}
        ;;
    logs)
        "${COMPOSE_CMD[@]}" logs -f ${ARGS[@]+"${ARGS[@]}"}
        ;;
esac
