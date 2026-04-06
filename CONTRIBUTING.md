# Contributing

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/)
- [Python](https://www.python.org/) and [uv](https://docs.astral.sh/uv/)

## Getting started

1. Clone the repo and enter the directory:

   ```bash
   git clone git@github.com:aboydnw/cng-sandbox.git
   cd cng-sandbox
   ```

2. Create your `.env` file:

   ```bash
   cp .env.example .env
   ```

   Fill in the R2 credentials. The Postgres defaults work for local development. See [CLAUDE.md](CLAUDE.md#environment) for details on each variable.

3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Verify at [http://localhost:5185](http://localhost:5185).

## Development workflow

1. Create a branch off `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes. See per-service READMEs for running individual services:
   - [frontend/README.md](frontend/README.md)
   - [ingestion/README.md](ingestion/README.md)

3. Run tests:

   ```bash
   cd frontend && npx vitest run
   cd ingestion && uv run pytest -v
   ```

4. Commit using [conventional commit](https://www.conventionalcommits.org/) prefixes — CI enforces this:

   | Prefix | Use for |
   |--------|---------|
   | `feat:` | New features |
   | `fix:` | Bug fixes |
   | `chore:` | Maintenance, deps |
   | `refactor:` | Code restructuring |
   | `docs:` | Documentation |
   | `test:` | Test changes |

5. Open a PR against `main`. CI must pass before merge.

## Project structure

| Directory | What | Details |
|-----------|------|---------|
| `frontend/` | React app (Vite) | [frontend/README.md](frontend/README.md) |
| `ingestion/` | Python API (FastAPI) | [ingestion/README.md](ingestion/README.md) |
| `docker-compose.yml` | Full local stack | — |
| `CLAUDE.md` | Architecture & conventions | Full reference for the project |

## API documentation

FastAPI auto-generates OpenAPI docs. When the stack is running, visit [http://localhost:5185/api/docs](http://localhost:5185/api/docs).

## Using Claude Code

This project includes a detailed [CLAUDE.md](CLAUDE.md) with architecture, service internals, gotchas, and conventions. It's designed to give AI coding assistants full project context.
