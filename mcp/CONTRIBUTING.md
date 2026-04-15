# Contributing to CNG MCP Server

## Development Setup

```bash
cd mcp
uv sync
```

## Test-Driven Approach

1. Write failing test
2. Run to confirm failure: `uv run pytest tests/test_foo.py::test_name -v`
3. Implement minimal code
4. Run tests: `uv run pytest tests/ -v`
5. Commit with conventional message

## Code Style

- No inline comments — code should speak for itself
- Docstrings for public functions
- Type hints for all signatures
- Async/await throughout

## Testing

- Tests live in `tests/` with `test_` prefix
- Use `pytest` + `pytest-asyncio`
- Mock HTTP calls (no real API in tests)
- Test happy path and error cases

## Commit Messages

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

## PRs

1. Push branch
2. Open PR with clear title and description
3. All tests must pass
