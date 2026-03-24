#!/usr/bin/env bash
set -euo pipefail

# Daily triage wrapper — invoked by cron or manually.
# Runs Claude Code CLI in non-interactive mode to triage open GitHub issues.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROMPT_FILE="$SCRIPT_DIR/triage-prompt.md"

# Pre-flight checks
if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found in PATH" >&2
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "ERROR: gh CLI not found in PATH" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI not authenticated" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: triage prompt not found at $PROMPT_FILE" >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "$(date -Iseconds) Starting triage run..."

timeout 1800 claude -p "$(cat "$PROMPT_FILE")" \
  --model opus \
  --permission-mode bypassPermissions \
  --disable-slash-commands \
  --append-system-prompt "Do NOT use plan mode or enter plan mode. Execute all actions directly."

EXIT_CODE=$?

if [[ $EXIT_CODE -eq 124 ]]; then
  echo "$(date -Iseconds) Triage run timed out after 30 minutes" >&2
elif [[ $EXIT_CODE -ne 0 ]]; then
  echo "$(date -Iseconds) Triage run failed with exit code $EXIT_CODE" >&2
else
  echo "$(date -Iseconds) Triage run completed successfully"
fi

exit $EXIT_CODE
