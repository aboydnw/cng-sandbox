#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs dependencies for the frontend (yarn), ingestion (uv + cng-toolkit),
# and MCP (uv) so tests and linters work in remote sessions.
set -euo pipefail

# Only run in remote (Claude Code on the web) sessions; local users manage
# their own envs via Docker.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$REPO_ROOT"

# Some web sandbox images install Node under /opt/node22 but don't always put
# it on PATH for hook subprocesses. Ensure node/corepack are findable.
if [ -d /opt/node22/bin ]; then
  export PATH="/opt/node22/bin:$PATH"
fi

echo "[session-start] Installing frontend deps (yarn 4 via corepack)..."
# repo.yarnpkg.com is blocked in the web sandbox; route corepack through npm.
export COREPACK_NPM_REGISTRY="${COREPACK_NPM_REGISTRY:-https://registry.npmjs.org}"
corepack enable >/dev/null 2>&1 || true
corepack prepare yarn@4.13.0 --activate >/dev/null
( cd frontend && yarn install --immutable )

echo "[session-start] Installing geo-conversions toolkit (uv)..."
( cd geo-conversions && uv sync --all-extras --frozen )

echo "[session-start] Installing ingestion deps (uv) + cng-toolkit..."
(
  cd ingestion
  uv sync --extra dev --frozen
  # cng-toolkit is required at runtime but lives outside the lockfile; install
  # it editable into the ingestion venv (matches CI setup).
  uv pip install -e "../geo-conversions[all]"
)

echo "[session-start] Installing MCP deps (uv)..."
( cd mcp && uv sync --extra dev --frozen )

# Expose helpful env vars for the rest of the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  if ! grep -Fqx 'export PATH="$HOME/.local/bin:$PATH"' "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
  fi
fi

echo "[session-start] Done."
