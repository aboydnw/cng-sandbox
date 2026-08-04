# CNG Sandbox design system

This directory is the canonical, versioned reference for product design in CNG
Sandbox. It is for UX designers, frontend developers, reviewers, and coding
agents who need to understand the interface before proposing or implementing a
change.

The system is intentionally lightweight. CNG Sandbox is changing quickly, so
these documents describe durable decisions and current production patterns
rather than attempting to freeze every screen. Update the relevant document in
the same pull request when a change establishes or replaces a lasting rule.

## Start here

- [Foundations](foundations.md) describes the visual vocabulary: color,
  typography, spacing, shape, depth, motion, layering, icons, and accessibility.
- [Components](components.md) catalogues the shared UI contracts that already
  exist in the React application.
- [Patterns](patterns.md) documents recurring product interactions and states
  that involve several components.
- [Frontend design audit](audit.md) classifies current inconsistencies,
  intentional exceptions, and consolidation priorities.
- [Design decisions](decisions/) record scoped choices that future contributors
  should neither spread nor remove accidentally.
- [Frontend gotchas](../frontend-gotchas.md) records implementation constraints
  for maps, stories, Chakra UI, exports, and other complex frontend behavior.
- [Design polish guide](../design-polish/README.md) preserves the detailed visual
  direction and migration assessment that informed the current system.

## Technology

The product interface is built with:

- React 19 and TypeScript
- Chakra UI v3 for primitives, styling props, tokens, and recipes
- Phosphor Icons for interface iconography
- Satoshi Variable for the primary type family
- MapLibre GL JS and deck.gl for map presentation
- Vitest and Testing Library for component and interaction tests

The implementation entry points are:

- [`frontend/src/theme.ts`](../../frontend/src/theme.ts) — tokens, semantic
  tokens, text styles, and component recipes
- [`frontend/src/styles.css`](../../frontend/src/styles.css) — font loading,
  document defaults, global accessibility behavior, and third-party overrides
- [`frontend/src/components/ui/`](../../frontend/src/components/ui/) — shared
  product UI components
- [`frontend/src/components/`](../../frontend/src/components/) — feature and
  cross-feature components
- [`frontend/src/pages/`](../../frontend/src/pages/) — route-level composition
- [`frontend/src/stories/`](../../frontend/src/stories/) — the local Storybook
  catalogue of implemented foundations, components, and states

Read `docs/frontend-gotchas.md` before changing anything under `frontend/src/`,
as required by the repository instructions.

## Source of truth

When sources appear to disagree, use this order:

1. Product behavior, accessibility requirements, and accepted specifications
   define what the experience must accomplish.
2. These design documents define durable design intent and established usage.
3. `frontend/src/theme.ts` and shared React components define the production
   styling and component contracts that currently ship.
4. Tests define behavior that must not regress.
5. Individual screens show a particular composition; they do not automatically
   establish a reusable rule.

An implementation can reveal that documentation is stale. Do not silently
choose one: update the documentation or identify the mismatch for review.

## Vocabulary

| Term              | Meaning                                                       | Example                              |
| ----------------- | ------------------------------------------------------------- | ------------------------------------ |
| Foundation        | A basic visual or interaction decision                        | Satoshi typography, focus treatment  |
| Token             | A named primitive value                                       | `brand.orange`, `radii.panel`        |
| Semantic token    | A name describing purpose rather than appearance              | `action.primary`, `fg.muted`         |
| Recipe            | Centralized styles and variants for a primitive               | Chakra button sizes and variants     |
| Component         | A reusable UI contract with behavior and content expectations | `StatePanel`, `ConfirmDialog`        |
| Pattern           | A recurring experience composed from multiple components      | Empty state, long-running conversion |
| Feature component | UI tied to a specific product capability                      | `RasterSidebarControls`              |
| Exception         | A deliberate departure with documented scope and reason       | A data-driven category color         |

## Status language

Use these labels when documenting parts of the system:

- **Established** — used in production and appropriate for new work.
- **Provisional** — used in production but still evolving; reuse carefully.
- **Exception** — intentionally limited to a named context.
- **Candidate** — repeated or promising, but not yet a shared contract.
- **Deprecated** — retained temporarily and should not gain new consumers.

Do not infer that repeated code is established. A pattern becomes established
when its responsibility, states, and intended consumers are understood.

## Proposing a change

Before introducing a new visual treatment or component:

1. Look for an established component or pattern in this directory.
2. Decide whether the need is a new token, recipe variant, component, pattern,
   or intentional one-off.
3. Prefer semantic roles over literal colors and page-specific styling.
4. Define relevant loading, empty, error, disabled, focus, narrow-screen, and
   reduced-motion behavior.
5. Reuse a shared abstraction only when it expresses a real product contract.
   A wrapper that merely renames a Chakra primitive is not automatically useful.
6. Update these documents when the decision should guide future work.

For a lasting exception, record its scope, reason, and conditions for revisiting
it. This keeps future contributors from either copying it everywhere or
removing it as an apparent inconsistency.

## Review questions

Design and frontend reviews should ask:

- Is the user intent clear before implementation terminology appears?
- Does an established component or pattern already cover this need?
- Are semantic tokens used where the color or style expresses a UI role?
- Are all request and interaction states represented?
- Is the keyboard and focus behavior clear?
- Does the experience remain usable at narrow widths and with reduced motion?
- Is a new system-level decision documented?

Run `yarn storybook` from `frontend/` to browse the implemented contracts. The
catalogue reflects these rules and is not a separate source of truth.
