#!/usr/bin/env bash
# Hook script: detect PR creation from Bash tool output and inject monitoring instructions.
# Called by the PostToolUse hook on every Bash tool invocation.
# Reads the hook payload from stdin (JSON with .tool_response).

set -euo pipefail

REPO_ROOT="/home/anthony/projects/cng-sandbox"

# Buffer stdin once — jq is consuming it twice (command + output).
payload=$(cat)

# Only fire when the executed command was actually `gh pr create`. Without this
# guard, any Bash that prints a PR URL (gh pr list, gh pr view, gh issue view,
# even an unrelated grep) triggers the documentation-audit subagent.
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null)
if ! printf '%s' "$command" | grep -qE '(^|[[:space:];&|]|&&|\|\|)gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  exit 0
fi

# Extract stdout from the tool response
output=$(printf '%s' "$payload" | jq -r 'if (.tool_response | type) == "string" then .tool_response else (.tool_response.stdout // "") end' 2>/dev/null)

# Look for a GitHub PR URL in the output of the gh pr create call
pr_url=$(echo "$output" | grep -oE 'https://github.com/[^ ]+/pull/[0-9]+' | head -1 || true)

if [ -z "$pr_url" ]; then
  exit 0
fi

# Parse owner/repo and PR number from the URL
owner_repo=$(echo "$pr_url" | sed -E 's|https://github.com/([^/]+/[^/]+)/pull/.*|\1|')
pr_number=$(echo "$pr_url" | sed -E 's|.*/pull/([0-9]+).*|\1|')

# Detect worktree path and branch.
# First try CWD (works when gh pr create runs from inside the worktree).
# Fall back to scanning git worktree list for a non-main branch.
worktree_path=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
branch=$(git -C "${worktree_path:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# If we resolved to the main repo on the main branch, the PR was likely created
# from a worktree but the hook CWD didn't match. Scan worktree list for the
# PR's head branch (via gh pr view).
if [ "$branch" = "main" ] && [ "$worktree_path" = "$REPO_ROOT" ]; then
  pr_branch=$(gh pr view "$pr_number" --repo "$owner_repo" --json headRefName -q .headRefName 2>/dev/null || echo "")
  if [ -n "$pr_branch" ] && [ "$pr_branch" != "main" ]; then
    # Find the worktree for this branch (porcelain format: worktree line, then HEAD, then branch)
    wt_path=$(git -C "$REPO_ROOT" worktree list --porcelain | grep -B2 "branch refs/heads/${pr_branch}$" | grep "^worktree " | sed 's/^worktree //' || true)
    if [ -n "$wt_path" ] && [ -d "$wt_path" ]; then
      worktree_path="$wt_path"
      branch="$pr_branch"
    fi
  fi
fi

# Scan for a plan file that matches this branch
plans_dir="$HOME/Obsidian/Project Docs/CNG Sandbox/plans"
matched_plan=""
if [ -d "$plans_dir" ]; then
  # Search plan files for the branch name (with or without the date prefix)
  matched_plan=$(grep -rl "$branch" "$plans_dir"/*.md 2>/dev/null | head -1 || true)
fi

plan_instruction=""
if [ -n "$matched_plan" ]; then
  plan_instruction=$(cat <<PLAN_EOF

2. PLAN COMPLETION — The plan file '${matched_plan}' references branch '${branch}'. Review the plan's checkbox tasks against the actual changes in the PR (git diff main...HEAD). For each task:
   - If the work was clearly done (files exist, tests pass, endpoint works): mark it [x].
   - If the work was skipped, descoped, or you're unsure: leave it [ ] and add a note like '(skipped — reason)' or ask the user.
   Only mark tasks complete if you're confident they were directly addressed by this PR. If you're unsure about the overall plan's completion status, ask the user.
PLAN_EOF
)
fi

context_message=$(cat <<MSG_EOF
PR CREATED: ${pr_url}

Do these things NOW:

1. DOCUMENTATION AUDIT — Spawn a background Agent subagent with this prompt:
   "You are working in the worktree at ${worktree_path} on branch ${branch}. A PR was just opened at ${pr_url}.
   Run: git diff main...HEAD --name-only
   Read CLAUDE.md (project root). Check if the documentation is still accurate given the changes. Look for: outdated descriptions, missing features or endpoints, stale ports or service names, incorrect instructions. Also check general cleanliness.
   If updates are needed: edit the files, commit with message 'docs: update project documentation', and push.
   If no updates needed: report that docs are current."${plan_instruction}

Do NOT start a PR monitoring loop. The user runs PR monitoring manually. When the user tells you the PR is merged, clean up: from ${REPO_ROOT} run \`git worktree remove ${worktree_path}\` and \`git branch -D ${branch}\`, check out main, pull, and write a devlog entry for the PR per CLAUDE.md.
MSG_EOF
)

jq -n --arg msg "$context_message" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $msg
  }
}'
