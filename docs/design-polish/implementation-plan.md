# Implementation plan

The polish program is divided into seven independently valuable work packages.
Each package should normally be one PR; split a package only when the resulting
PRs still deliver complete user-facing improvements rather than half-migrated
component infrastructure.

## Sequence at a glance

| Order | Work package | Relative size | Risk | Depends on |
|---:|---|---:|---:|---|
| 1 | Design foundations | Medium | Low | — |
| 2 | Navigation and application shell | Small–medium | Low | 1 |
| 3 | Landing page and example presentation | Medium | Low | 1–2 |
| 4 | Workspace home, Stories, and Data | Medium–large | Medium | 1–3 shared patterns |
| 5 | Upload, connect, and conversion | Medium | Medium | 1–2 |
| 6 | Map workspace | Large | High | 1–2, preferably 4–5 |
| 7 | Story editor and final quality pass | Large | Medium | 1–6 |

Packages 3 and 5 may proceed in parallel after foundations and navigation are
stable. Keep package 6 isolated because map controls touch many specialized
data paths.

## Progress

- [x] Package 1 — Design foundations (implemented 2026-07-21 on
  `codex/design-polish-guide`)
- [ ] Package 2 — Navigation and application shell
- [ ] Package 3 — Landing page and example presentation
- [ ] Package 4 — Workspace home, Stories, and Data
- [ ] Package 5 — Upload, connect, and conversion
- [ ] Package 6 — Map workspace
- [ ] Package 7 — Story editor and final quality pass

## 1. Design foundations

### Outcome

Create a coherent shared visual language without changing page structure or
product behavior.

### Scope

- Expand semantic color tokens for canvas, surfaces, text, borders, focus,
  disabled, warning, danger, and map overlays.
- Define typography, radius, shadow, spacing, and numeric roles.
- Standardize primary, secondary, quiet, destructive, and icon-button states.
- Standardize fields, notices, state panels, skeletons, and panel headers as
  they gain real consumers.
- Add global focus, text wrapping, reduced-motion, and skip-link behavior.
- Migrate a small pair of representative consumers for each new shared pattern.

### Exclusions

- Major page layout changes.
- Repository-wide style replacement without consumer-focused review.
- New UI libraries.

### Acceptance criteria

- Existing screens retain their behavior.
- Shared interactive elements have hover, pressed, focus, disabled, and loading
  treatments.
- New semantic tokens replace mixed warm/cool defaults in the migrated areas.
- Relevant unit tests and the frontend build pass.

## 2. Navigation and application shell

### Outcome

Users always know where they are, what they can do next, and how to return.

### Scope

- Add active navigation states.
- Add a predictable primary-action area.
- Simplify the workspace label and expose the raw ID inside its menu.
- Add consistent page-header and back-navigation patterns.
- Implement responsive navigation and a skip-to-content route.
- Align footer width and hierarchy with page content.

### Exclusions

- Changes to workspace routing, identity, or storage semantics.
- Authentication or account concepts.

### Acceptance criteria

- Current location is visually and programmatically indicated.
- Detail and editor routes have an obvious return path.
- Navigation remains usable at 390px and 200% zoom.
- Workspace copy/switch/primary behaviors remain intact.

## 3. Landing page and example presentation

### Outcome

The first screen demonstrates a real geospatial result and has a distinctive,
product-led composition.

### Scope

- Replace the centered template hero with an asymmetric composition.
- Feature one example story with two secondary examples.
- Use saved snapshots or intentional format-specific preview fallbacks.
- Tighten product positioning and supporting copy.
- De-emphasize existing-workspace entry and production-service context without
  hiding either.
- Add shape-matched loading states.

### Exclusions

- Changes to workspace creation or example cloning APIs.
- New marketing pages.

### Acceptance criteria

- A real product output is visible before scrolling at wide desktop widths.
- The main action is visually unambiguous.
- Example loading and cloning do not cause layout jumps.
- Mobile content order preserves claim, evidence, and action.

## 4. Workspace home, Stories, and Data

### Outcome

Users can resume work, distinguish their content from examples, and understand
collection state at a glance.

### Scope

- Reframe workspace home around continuing recent work.
- Introduce reusable story and dataset previews with real imagery/fallbacks.
- Add grouped creation actions.
- Harmonize Data and Stories page headers, rows/cards, status, and actions.
- Add skeleton, empty, error, and retry states that preserve page structure.
- Clarify example-copy ownership.
- De-emphasize destructive actions until invoked.

### Exclusions

- Changes to dataset/story lifecycle APIs.
- New search, sorting, or pagination unless required to keep existing behavior
  usable in the revised layout.

### Acceptance criteria

- Recent work is accessible from the initial viewport.
- Examples cannot be mistaken for user-created content.
- Loading, empty, and error states all provide an appropriate next action.
- Long names and mixed statuses remain scannable at all standard widths.

## 5. Upload, connect, and conversion

### Outcome

Users can choose the right ingestion path and trust the system during long
processing steps.

### Scope

- Explain upload, remote connection, and story-building paths by outcome.
- Group and fully list supported formats.
- Remove ambiguous nested click behavior from the drop zone.
- Show selected file name, type, and size before processing.
- Improve format-specific validation and recovery guidance.
- Standardize real conversion stages, warnings, failures, retry, and
  leave-page guidance.
- Improve the successful handoff into the map.
- Add accessible status announcements.

### Exclusions

- Conversion pipeline changes except where a UI contract correction is
  separately reviewed.
- Invented progress percentages.

### Acceptance criteria

- Users can choose a path without knowing storage or tiling architecture.
- All supported formats are represented accurately.
- Every recoverable error provides a next action.
- Paused-for-input, processing, warning, failure, and ready states are visually
  distinct and tested.

## 6. Map workspace

### Outcome

The default map view feels calm and focused while expert controls remain easy
to find.

### Scope

- Establish stable regions for dataset identity, map, appearance, exploration,
  and sharing.
- Standardize panel headers, grouping, collapse, reset, and help behavior.
- Separate common controls from advanced controls.
- Harmonize all floating map controls, tooltips, legends, and popups.
- Improve basemap labels and non-color selected states.
- Provide responsive panel-to-drawer/sheet behavior.
- Improve map loading, unsupported, and error presentation.
- Preserve relevant presentation choices when safe and expected.

### Exclusions

- MapLibre/deck.gl architecture changes.
- Layer-builder or tile-URL refactors.
- New analytical features.
- Changes to categorical, temporal, Zarr, COPC, GPX, or 3D rendering behavior.

### Acceptance criteria

- Common controls are immediately available and advanced controls are
  discoverable.
- Controls remain legible over light, dark, and imagery basemaps.
- Raster, vector, temporal, Zarr, COPC, and trajectory paths retain behavior.
- Map-control collisions and viewport clipping are tested at standard widths.

## 7. Story editor and final quality pass

### Outcome

Authors understand story structure, save state, reader output, and publish
readiness throughout the workflow.

### Scope

- Strengthen selected, complete, incomplete, warning, and drag states in the
  chapter list.
- Improve new-story and empty-chapter guidance.
- Harmonize chapter-type selection and chapter-specific editor frames.
- Clarify save, preview, publish, share, and export hierarchy.
- Separate blocking publish issues from advisory warnings.
- Standardize inline validation and preserve user input through failures.
- Run final responsive, keyboard, contrast, reduced-motion, terminology, and
  visual-consistency audits across the product.
- Add focused regression tests for shared patterns and critical interactions.

### Exclusions

- New chapter types or publishing destinations.
- Story rendering architecture changes.

### Acceptance criteria

- Authors can identify current chapter, completion state, and save state without
  ambiguity.
- Editors for different chapter types feel part of one system.
- Publishing communicates exactly what readers will see.
- The full visual QA checklist is completed for affected routes.

## Working rules for every package

1. Create a dedicated worktree and `codex/` branch.
2. Capture applicable before states from the visual QA checklist.
3. Implement through existing technology and preserve behavioral contracts.
4. Add or update tests in proportion to interaction risk.
5. Check 1440px, 1024px, 768px, and 390px where layout changes.
6. Check keyboard focus, loading, empty, error, long-content, and disabled states.
7. Run the frontend tests and build relevant to the changed surface.
8. Document intentional deviations from this guide in the PR.
9. After a significant feature or fix is pushed and its PR is opened, follow
   the project devlog instructions in `AGENTS.md`.

## Definition of done for the program

- The landing page leads with authentic product evidence.
- Navigation and page hierarchy are consistent across workspace routes.
- Stories and datasets have recognizable preview and collection patterns.
- Upload and conversion states communicate progress and recovery.
- Map controls form a coherent, accessible shell across every supported data
  path.
- The story editor communicates structure, save status, and readiness.
- No major surface relies on a plain spinner, blank page, or generic error for
  its primary loading, empty, or failure experience.
- Semantic tokens and shared patterns cover common UI decisions without
  forcing feature logic into a generic component layer.
