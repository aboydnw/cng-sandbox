# CI/CD

Read this when touching GitHub Actions workflows, debugging release-please, reviewing Dependabot PRs, or adjusting conventional-commit enforcement.

## Pull Requests

All changes go through PRs. Branch protection requires `backend`, `frontend`, `docker-build`, and `conventional-commits` CI jobs to pass before merge. PR titles must follow conventional commit format — this is enforced by the `conventional-commits` workflow.

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). It watches `main` for conventional commits (`feat:`, `fix:`, etc.) and maintains an open Release PR with a changelog and version bump.

**To release:** Merge the Release PR. This triggers auto-deploy to the Hetzner VM.

**Manual deploy:** Use the "Run workflow" button on the release-please workflow in GitHub Actions to deploy without creating a release.

**Version:** Tracked in `version.txt` (managed by release-please, don't edit manually).

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
- Docker base images in `caddy/`, `frontend/`, and `ingestion/`

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
