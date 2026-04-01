#!/usr/bin/env bash
# Verify that Vite dev proxy and Caddyfile proxy routes stay in sync.
#
# For every proxy path that appears in BOTH vite.config.ts and Caddyfile,
# check that prefix stripping is consistent: if one strips, both must strip.
# The /api path is excluded because the backend expects the /api prefix.
set -euo pipefail

VITE_CONFIG="frontend/vite.config.ts"
CADDYFILE="Caddyfile"
ERRORS=0

# Paths that intentionally keep their prefix
SKIP_PATHS=("/api")

is_skipped() {
  local path="$1"
  for skip in "${SKIP_PATHS[@]}"; do
    [[ "$path" == "$skip" ]] && return 0
  done
  return 1
}

# --- Extract all Vite proxy paths ---
mapfile -t vite_paths < <(grep -oP '^\s+"(/[^"]+)"' "$VITE_CONFIG" | grep -oP '/[^"]+')

# --- Check each Vite path for rewrite ---
declare -A vite_rewrites
for path in "${vite_paths[@]}"; do
  # Look for rewrite on lines near this path definition
  if grep -A5 "\"$path\"" "$VITE_CONFIG" | grep -q 'rewrite:'; then
    vite_rewrites[$path]=1
  else
    vite_rewrites[$path]=0
  fi
done

# --- Extract Caddy handle paths and check for strip_prefix ---
declare -A caddy_strips
while IFS= read -r line; do
  path=$(echo "$line" | grep -oP 'handle\s+(/[^\s/*]+)' | grep -oP '/\S+') || continue
  # Check if the block following this handle has uri strip_prefix
  if grep -A5 "handle ${path}/\*" "$CADDYFILE" | grep -q 'uri strip_prefix'; then
    caddy_strips[$path]=1
  else
    caddy_strips[$path]=0
  fi
done < <(grep 'handle /.*\*' "$CADDYFILE")

# --- Compare paths that exist in both ---
for path in "${vite_paths[@]}"; do
  is_skipped "$path" && continue
  # Only check paths present in both configs
  [[ -z "${caddy_strips[$path]+x}" ]] && continue

  vite_strips=${vite_rewrites[$path]}
  caddy_does=${caddy_strips[$path]}

  if [[ "$vite_strips" -eq 1 && "$caddy_does" -eq 0 ]]; then
    echo "ERROR: $path — Vite rewrites prefix but Caddyfile does not strip it"
    ERRORS=$((ERRORS + 1))
  elif [[ "$vite_strips" -eq 0 && "$caddy_does" -eq 1 ]]; then
    echo "ERROR: $path — Caddyfile strips prefix but Vite does not rewrite it"
    ERRORS=$((ERRORS + 1))
  fi
done

if [[ "$ERRORS" -gt 0 ]]; then
  echo ""
  echo "FAILED: $ERRORS proxy parity error(s) found."
  echo "Every proxy that strips its prefix in vite.config.ts must also"
  echo "have 'uri strip_prefix' in the Caddyfile, and vice versa."
  exit 1
fi

echo "OK: Vite and Caddy proxy configurations are in sync."
