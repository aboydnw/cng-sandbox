# CI/CD

Read this when touching GitHub Actions workflows, debugging release-please, reviewing Dependabot PRs, or adjusting conventional-commit enforcement.

## Pull Requests

All changes go through PRs. Branch protection requires `backend`, `frontend`, `docker-build`, and `conventional-commits` CI jobs to pass before merge. PR titles must follow conventional commit format — this is enforced by the `conventional-commits` workflow.

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). It watches `main` for conventional commits (`feat:`, `fix:`, etc.) and maintains an open Release PR with a changelog and version bump.

**To release:** Merge the Release PR. This triggers a build-and-push step that publishes the `ingestion` and `frontend-build` images to `ghcr.io/aboydnw/cng-sandbox/*` (tagged `:latest` and `:vX.Y.Z`), then auto-deploys to the Hetzner VM.

**Manual deploy:** Use the "Run workflow" button on the release-please workflow in GitHub Actions. This rebuilds and republishes the images, then redeploys without creating a release.

**Version:** Tracked in `frontend/version.txt` and `mcp/pyproject.toml` (both managed by release-please via `extra-files`, don't edit manually). The `mcp/pyproject.toml` version uses a typed `toml` updater (`jsonpath: $.project.version`) so the published `cngstorytelling-mcp` package version stays in lockstep with the repo release.

## Publishing the `cngstorytelling-mcp` package to PyPI

The MCP server (`mcp/`) is published to PyPI as [`cngstorytelling-mcp`](https://pypi.org/project/cngstorytelling-mcp/) by `.github/workflows/publish-mcp.yml`, using **PyPI Trusted Publishing (OIDC)** — no API tokens or stored secrets. (The installed console command is `cng-mcp`.)

- **Triggers:** `release: published` (publishes to PyPI automatically when release-please cuts a release) and `workflow_dispatch` with a `target` input (`testpypi` | `pypi`) for manual/dry runs.
- **Jobs:** `build` (`uv build` → sdist+wheel artifact) → `publish-testpypi` / `publish-pypi` (download artifact, `pypa/gh-action-pypi-publish` via OIDC). The publish jobs use GitHub environments `testpypi` / `pypi` and `id-token: write`.

**One-time setup (required before the first publish, owner action):** claim the `cngstorytelling-mcp` project on both [PyPI](https://pypi.org/manage/account/publishing/) and [TestPyPI](https://test.pypi.org/manage/account/publishing/), and register this repo as a Trusted Publisher in each (owner `aboydnw`, repo `cng-sandbox`, workflow `publish-mcp.yml`, environment `pypi` / `testpypi`). Then validate with a TestPyPI dry run before relying on the release path:

```bash
gh workflow run publish-mcp.yml -f target=testpypi
```

## Deploy mechanics (GHCR-based)

The `release-please` workflow has three jobs that run in order: `release-please` (manages the Release PR), `build-and-push` (builds and pushes images to GHCR), and `deploy` (SSHes to the Hetzner VM and runs `docker compose --profile prod pull && up -d`). Because the VM pulls pre-built images instead of building locally, deploys take ~30-60s instead of several minutes and use far less VM CPU/RAM.

Caddy uses the upstream `caddy:2` image directly (no custom Dockerfile). During the brief restart window when ingestion or the tilers cycle, Caddy's `handle_errors 502 503` block serves a self-refreshing maintenance page (`Caddyfile`) so users see "Deploying…" instead of a raw error.

### SSH host-key verification

The deploy job verifies the Hetzner VM's host key against a pinned `known_hosts` instead of `StrictHostKeyChecking=no`. It reads the `DEPLOY_KNOWN_HOSTS` repository secret and fails fast with a clear error if the secret is missing. To set it up (or rotate after a host-key change), run `ssh-keyscan <deploy host>` and save the output as the `DEPLOY_KNOWN_HOSTS` secret.

## GitHub App for Release-Please (optional)

By default, release-please uses `GITHUB_TOKEN`, which means its PRs won't trigger CI checks (GitHub limitation). To fix this, set up a GitHub App:

1. Create a GitHub App in your account settings with permissions: Contents (write), Pull Requests (write), Metadata (read)
2. Install the app on the `cng-sandbox` repository
3. In repo Settings > Secrets and variables > Actions:
   - Add `RELEASE_BOT_ID` as a **variable** (the App ID)
   - Add `RELEASE_BOT_PRIVATE_KEY` as a **secret** (the private key PEM)

## Dependency updates

Dependabot is configured via `.github/dependabot.yml` to open weekly PRs for:

- GitHub Actions
- npm dependencies in `frontend/`
- uv dependencies in `ingestion/` and `mcp/`
- Docker base images in `frontend/` and `ingestion/`

Minor and patch updates are grouped per ecosystem to limit PR noise; major updates open as individual PRs so they get reviewed on their own. Each ecosystem uses a 7-day cooldown so Dependabot skips versions released in the last week (reduces exposure to compromised fresh releases). Dependabot PRs go through the same CI checks as any other PR. Review and merge them like normal feature PRs — release-please will fold the resulting `chore(deps):` commits into the next release changelog.

When debugging or reviewing a frontend dependency upgrade, verify both the declared/locked versions and the actually installed tree. This frontend uses Yarn 4 with `nodeLinker: node-modules`, so `package.json` / `yarn.lock` can say one thing while a stale `node_modules` tree still runs an older package. Check with `yarn why <package>` and, when runtime behavior is suspect, `node -p "require('./node_modules/<package>/package.json').version"` from `frontend/`; run `yarn install` if they disagree. Also audit local compatibility shims/workarounds that were added for the old version. An upgrade can be present but still behave like the old version if custom wrappers keep applying now-obsolete behavior.

## Conventional Commits

All commits to `main` must use conventional prefixes:

| Prefix | Meaning | Version bump |
|--------|---------|-------------|
| `feat:` | New feature | minor (0.1.0 → 0.2.0) |
| `fix:` | Bug fix | patch (0.1.0 → 0.1.1) |
| `feat!:` or `fix!:` | Breaking change | major (0.1.0 → 1.0.0) |
| `chore:`, `docs:`, `refactor:`, `test:` | Maintenance | no bump (appears in changelog) |

The enforcement workflow (`.github/workflows/conventional-commits.yml`) accepts `feat`, `fix`, `docs`, `chore`, `refactor`, and `test` prefixes. Only `feat`/`fix` (and their `!` breaking variants) trigger a release-please version bump; the rest land in the changelog without bumping.
