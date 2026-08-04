# Frontend design audit

This audit classifies styling found in `frontend/src/` so contributors can
distinguish system debt from legitimate exceptions. It is a working inventory,
not a requirement to mechanically replace every literal value.

## Classification rules

| Classification                | Meaning                                                                                    | Expected treatment                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Core system                   | A durable application-wide decision                                                        | Reuse tokens, recipes, and shared components                              |
| Intentional product variation | A scoped visual language serving a distinct product context                                | Document its boundary; do not spread or normalize casually                |
| Data-driven value             | A color or style represents data or user authorship                                        | Keep it explicit and separate from interface semantics                    |
| Rendering constraint          | A library, canvas, WebGL, generated document, or external format requires a concrete value | Centralize when practical; do not force CSS tokens into incompatible APIs |
| Consolidation candidate       | Repeated UI meaning expressed through local or framework-default styling                   | Move toward semantic tokens or a shared contract incrementally            |
| Local one-off                 | A value has no clear reusable meaning                                                      | Review when its surrounding feature changes                               |

## Core system

The current core system is:

- Satoshi Variable for application body and heading typography
- Warm canvas, surface, border, and text roles from `theme.ts`
- Orange primary action and focus treatment
- Semantic success, warning, danger, and information roles
- Chakra button and input recipes
- `control` and `panel` radii, warm shadow scale, motion durations, and z-index
  layers
- Phosphor interface icons
- Shared request-state, confirmation, resource collection, loading, save, and
  progress components

New reusable work should use semantic names such as `fg.muted`, `bg.raised`,
`border`, and `status.danger.fg`, rather than default Chakra palette steps.

## Intentional product variation

### Discover editorial language

`DiscoverPage`, `DiscoverDatasetPage`, and `DiscoverHeader` use a serif/monospace
editorial pairing, ink-like navy accent, and their own warm neutral values. This
is treated as a scoped product-area variation while its product role remains
distinct. See
[`decisions/0001-discover-editorial-language.md`](decisions/0001-discover-editorial-language.md).

This classification does not exempt Discover from accessibility, responsive,
interaction-state, or content standards.

### Story-authored themes

Embed and story theme controls intentionally accept author-selected accent,
background, heading-font, and body-font values. These values represent authored
output, not the application shell. Defaults may originate in the core system,
but stored author choices must not be rewritten as UI tokens.

## Data-driven values

Keep these concrete and domain-owned:

- Raster colormaps and continuous/categorical lookup tables
- User-edited category colors
- Overlay stroke and fill colors
- Dataset-type swatches when they encode type consistently
- RGB legend gradients
- Basemap previews and cartographic styling
- Chart-series colors and story-authored visualization colors

Data colors must still meet the accessibility needs of their context. When color
communicates a category or state, provide a label, legend, pattern, or another
noncolor cue where practical.

## Rendering constraints

Concrete color values are expected at boundaries that cannot reliably consume
Chakra CSS variables, including:

- MapLibre styles and markers
- deck.gl/luma.gl layer props and shader lookup tables
- DOM elements created imperatively by map libraries
- Canvas chart capture
- Generated archival HTML and interactive export CSS
- Native range-input `accentColor` passed through inline style

Prefer a named exported constant when the same product color crosses several
rendering boundaries. Do not import React theme machinery into rendering or
export code simply to eliminate a hex literal.

## Consolidation candidates

### High priority: shared contracts

The first consolidation pass covers:

- `ResourceCollection` surface, border, and text hierarchy
- `ResourceThumbnail` fallback surface and accent
- `SaveStatus` saving, saved, and failure semantics
- `ProgressTracker` stage, connector, and action semantics
- `SnapButton` map surface and error semantics

These components are reused or represent established product patterns, so local
palette choices would propagate inconsistency.

### Next priority: feature families

Address these when their feature area is already in scope:

- Story reader prose colors repeated across image, video, prose, map, flyover,
  hydration placeholder, and runtime components
- Form labels, hints, warning panels, and inline errors across connection,
  variable, Zarr, SQL, and editor controls
- Dialog body text, code surfaces, success messages, and destructive actions
- Story editor saved/published states
- Map-control surfaces and selected states beyond snapshot capture
- Dense About-page tables and prose hierarchy

These are unsuitable for a repository-wide search-and-replace. Each family has
behavioral and responsive context that should be tested while consolidating it.

### Low priority or opportunistic

- Optical one-pixel borders inside specialized editors
- Third-party component overrides
- Legacy pages that are likely to be redesigned soon
- Values already isolated behind one feature component

Do not create abstractions solely to remove these literals.

## Common findings

### Default Chakra grays

Existing `gray.*` values often mean one of `fg`, `fg.muted`, `fg.subtle`,
`border`, `bg.subtle`, or `bg.emphasized`. Replace them only after confirming the
intended role. A numeric gray step does not describe intent and can introduce a
cool neutral into the warm system.

### Default status palettes

Existing `red.*`, `green.*`, and `orange.*` values usually map to semantic
danger, success, or warning roles. A warning is not interchangeable with the
brand action orange. Status treatments should use their foreground, subtle
background, and border roles together.

### Repeated brand literals

The orange hex appears in icons, native controls, map markers, and other
non-Chakra boundaries. Chakra components should use `action.primary`. Boundary
code may use an exported product-color constant where that reduces drift.

### Literal font sizes

Small literal sizes are common in dense map and editor controls. Important page
hierarchy should use named text styles. Compact specialist controls can retain
local sizes until a repeated component contract is clear; do not make important
text smaller than 12px.

## Audit workflow for future changes

When a feature is touched:

1. Classify its local values using this document.
2. Preserve data, author, and rendering-boundary values.
3. Replace UI-role palette values with semantic tokens.
4. Consolidate only contracts with concrete consumers.
5. Test behavior, focus, responsive states, and meaningful request states.
6. Update this audit if the classification or priority changes.
