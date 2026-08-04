# Frontend

React 19 app with Chakra UI v3, MapLibre GL JS (vector maps), and deck.gl (raster maps). The Vite dev server proxies API and tiler requests so the browser only talks to one port.

## Quick start

For frontend-only changes, you can skip Docker and run against the existing backend:

```bash
yarn install
yarn dev
```

This starts Vite on [http://localhost:5185](http://localhost:5185), proxying API requests to the Docker backend services.

For full-stack changes, start Docker from the repo root first — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Tests

```bash
npx vitest run
```

## Component catalogue

Run the local Storybook catalogue to inspect design foundations, shared
components, and recurring UI states without navigating the full application:

```bash
yarn storybook
```

Storybook runs at [http://localhost:6006](http://localhost:6006). It uses the
production Chakra theme, global CSS, local fonts, and an in-memory router. The
accessibility panel provides local automated feedback; Storybook is not hosted
and is not currently a required CI or visual-regression check.

Build the static catalogue locally with `yarn storybook:build`.

## Key directories

| Directory          | Contents                                    |
| ------------------ | ------------------------------------------- |
| `src/components/`  | UI components                               |
| `src/hooks/`       | Custom React hooks                          |
| `src/pages/`       | Route-level page components                 |
| `src/stories/`     | Local Storybook catalogue                   |
| `src/types/`       | Shared TypeScript types                     |
| `src/lib/maptool/` | Vendored map utilities (from @maptool/core) |

## More details

See [CLAUDE.md](../CLAUDE.md#frontend) for design conventions (icons, brand palette), proxy configuration, and MapLibre/deck.gl gotchas.
