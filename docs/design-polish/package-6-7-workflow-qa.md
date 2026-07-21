# Packages 6–7 workflow QA

Date: 2026-07-21
Branch: `codex/design-polish-packages-6-7`

This record connects individual controls to the full user journey. It is meant
to catch locally polished controls that fail when used in sequence.

## Journey 1: finished conversion to useful map

1. **Open the result.** The map uses a map-shaped loading state with a stable
   desktop panel placeholder. A failed request preserves the application shell,
   explains that the map could not open, and provides **Try again**.
2. **Orient to the data.** The dataset title and data switcher identify the
   active source. Upload and connection detours return to the controls and
   navigate to the newly created source.
3. **Choose context.** Every basemap has a visible text label, named button,
   `aria-pressed` state, and checkmark; selection never relies on swatch color.
4. **Adjust appearance.** Raster, vector, and COPC paths use the same panel
   region. Opacity, band, colormap, rescale, category, vector mode, point color,
   and point size controls remain named and keyboard reachable.
5. **Find advanced behavior.** Client-side rendering is a named switch with
   state announced through `aria-checked`. Unavailable client rendering keeps
   its reason next to the setting.
6. **Explore or inspect.** GeoParquet Explore reports local-tool startup in
   product language and offers retry. Feature details have a named region and
   close action. Legends use unique disclosure targets and Phosphor carets.
7. **Move through time.** Temporal and trajectory transports expose play,
   pause, previous, next, scrub, speed, and export actions by name. Controls
   wrap below desktop width and retain tabular timestamps.
8. **Use a narrow screen.** Below the desktop breakpoint, **Map controls** opens
   the same complete panel as a bounded bottom sheet. COPC controls no longer
   disappear into a desktop-only floating card.
9. **Take the work forward.** Snapshot reports capture state, Share preserves
   its existing privacy flow, and Save as story chapter carries the active COPC
   presentation when relevant.

## Journey 2: create, review, and publish a story

1. **Open the editor.** Loading preserves the three authoring regions at wide
   widths. Failure offers a clear route back to Stories.
2. **Understand the canvas.** At 1024px and wider, chapters, preview, and editor
   retain their stable regions. Below that width, explicit **Chapters**,
   **Preview**, and **Edit** tabs prevent squeezed or unreachable panels.
3. **Choose a chapter.** Chapter rows are keyboard selectable and announce
   their order, title, selection, and first missing requirement. Selecting a
   chapter on a narrow screen moves directly to Edit.
4. **Understand readiness.** Each chapter shows Ready or a concrete next step
   such as adding reader text, choosing map data, or adding flyover keyframes.
   State uses an icon and words, not color alone.
5. **Reorder or remove.** Drag state remains visible. Named up/down controls
   provide the keyboard equivalent, boundary actions are marked disabled, and
   deletion retains explicit confirmation.
6. **Choose a format.** Chapter-type options are a named group; every option
   exposes its purpose and pressed state. Type-specific editors remain inside
   the shared Edit region.
7. **Frame the output.** Map navigation continues to auto-save; reset appears
   only after the current camera differs. Non-map chapters show their live
   preview in the same Preview mode.
8. **Build context.** Dataset/connection selection, uploads, overlays, 3D
   settings, keyframes, and narrative editing retain existing data contracts.
   Save feedback is announced politely without stealing focus.
9. **Review.** Preview is a secondary action that opens reader output. Export
   remains available but quiet. Publish (or Share settings after publication)
   is the clear primary action.
10. **Publish intentionally.** Missing story title or chapters blocks publish.
    Incomplete chapter content is listed separately as advisory, so authors can
    deliberately publish a sparse story. Published output exposes copy,
    export, sharing, and unpublish actions without mixing destructive intent
    into the primary button.

## Viewport and state checks

- Responsive rules reviewed at 1440, 1024, 768, and 390 widths. The map panel
  changes from a fixed side region to a bounded sheet; the editor changes from
  three simultaneous regions to one explicit mode.
- Loading, recoverable error, selected, incomplete, saved, published,
  disabled, and active transport states were exercised through focused tests.
- Basemap selection, chapter selection/reorder labels, readiness, publishing,
  COPC settings, raster settings, trajectory controls, overlays, and map/story
  data paths have regression coverage.
- Headless Chrome rendered the 390px map and editor recovery routes without a
  page crash. Populated live rendering could not be completed because the
  public `GET /api/stories/examples` endpoint returned HTTP 500 during QA;
  data-path behavior was instead covered by the complete mocked frontend suite.

## Automated validation

- TypeScript: `npx tsc --noEmit` — passed.
- Frontend tests: 175 files, 1,112 tests — passed.
- Production viewer and application build: `yarn build` — passed.
- Formatting and Git whitespace checks — passed before commit.

## Intentional boundaries

- No MapLibre, deck.gl, tiler, conversion, story-rendering, or export contracts
  changed.
- The mobile map control surface is a bounded non-modal sheet so users can
  still inspect the map above it; it does not introduce a second control state.
- Chapter content gaps are advisory unless the story lacks its own title or
  any chapters. This preserves intentional visual or map-only storytelling.
