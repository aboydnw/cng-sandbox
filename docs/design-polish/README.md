# Design polish guide

This guide is the shared reference for making CNG Sandbox feel deliberate,
complete, and recognizably geospatial without changing its underlying product
behavior. It translates the July 2026 UX assessment into a visual direction,
component migration inventory, validation checklist, and sequenced delivery
plan.

## Documents

- [Visual direction](visual-direction.md) — the design principles, type, color,
  surfaces, imagery, interaction, and responsive rules to use when making UI
  decisions.
- [Component inventory](component-inventory.md) — current surfaces mapped to
  shared patterns and recommended migration order.
- [Visual QA checklist](visual-qa-checklist.md) — required screenshots, states,
  viewport coverage, and review criteria for each polish PR.
- [Implementation plan](implementation-plan.md) — seven independently useful
  work packages with boundaries, dependencies, and acceptance criteria.

## Product character

CNG Sandbox should feel like a capable geospatial workbench made by people who
work with real data: warm, precise, map-led, and quietly technical. It should
not resemble a generic SaaS dashboard, a marketing template, or a developer
console exposed directly to end users.

When choices conflict, prioritize:

1. Clear user intent over implementation terminology.
2. Real product evidence over decorative graphics.
3. Stable hierarchy over adding more containers.
4. Progressive disclosure over showing every capability at once.
5. Consistency and accessibility over novelty.

## Scope guardrails

- Preserve routes, content, analytics hooks, sharing semantics, and workspace
  behavior.
- Preserve the React, Chakra UI, MapLibre, and deck.gl stack.
- Use Phosphor icons and the existing warm brand palette.
- Do not change map rendering architecture as part of visual polish.
- Treat loading, empty, error, disabled, and narrow-screen states as part of the
  feature, not cleanup after the main design is complete.
- Read [`docs/frontend-gotchas.md`](../frontend-gotchas.md) before changing map,
  story, or frontend data-flow components.

## How to use this guide

Before starting a design-polish PR:

1. Pick one work package from the implementation plan.
2. Consult the component inventory for shared patterns to introduce or reuse.
3. Apply the visual direction rather than inventing page-specific styling.
4. Capture the applicable screenshot matrix before and after the change.
5. Record intentional deviations in the PR description and update this guide
   if the decision should become a lasting rule.
