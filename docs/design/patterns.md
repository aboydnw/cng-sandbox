# Product patterns

Patterns describe recurring experiences composed from several components,
state transitions, content rules, and accessibility behavior. Reuse the whole
pattern when the situation matches; copying only its visual surface often loses
the behavior that makes it reliable.

## Request and collection states

**Status:** Established

Workspace collections use explicit `loading`, `ready`, `empty`, and `error`
states. Previously loaded content remains visible during refresh. Datasets and
connections load independently so a partial failure does not hide successful
content.

Rules:

- Loading reserves the eventual layout with an appropriate skeleton where
  possible.
- Empty means the request succeeded and no resources exist; it is not a fallback
  for an error or unresolved identifier.
- An error names what failed and offers a specific retry when retry is possible.
- Partial success keeps successful content usable and places the error near the
  failed portion.
- Refresh does not replace useful content with a blank spinner.
- An unavailable selected resource is labelled unavailable and asks the user to
  choose a replacement; it is not described as still loading.

Use `StatePanel` for bounded empty and error communication. Keep retry controls
keyboard accessible and avoid losing user selections during recovery.

## Creation actions

**Status:** Established

Top-level actions describe outcomes:

- “Create map”
- “Create story”

“Upload data” and “Connect data” are contextual actions within an authoring
flow. Route names and ingestion mechanisms are not user-facing vocabulary. Do
not duplicate the same primary creation action within one page.

Creation routes delay persistence until the first meaningful user action. A
navigation choice alone should not create an abandoned server resource.

Canonical labels and route mappings live in
`frontend/src/lib/creationIntents.ts`; see `docs/frontend-gotchas.md` before
changing them.

## Forms and validation

**Status:** Established principles; field composition remains provisional

- Put labels above or directly beside their control; placeholders do not replace
  labels.
- Use hints for constraints the user needs before submission.
- Validate at a point where the user can act on the result without interrupting
  ordinary typing.
- Keep the submitted value when a request fails.
- Place errors near the affected control or decision and provide an error
  summary when failures span several fields.
- Mark invalid controls programmatically and connect explanatory text.
- Disable submission only when the reason is apparent; otherwise let the user
  submit and explain what is missing.
- During submission, prevent duplicate work and preserve a clear status label.
- Put specialist or rarely needed fields behind progressive disclosure.

CSV/TSV geometry mapping and NetCDF/HDF5 variable selection are resumable
pipeline decisions, not generic validation failures. Their UI should explain
that conversion is waiting for input.

## Dialogs, popovers, and transient feedback

**Status:** Established

Dialogs interrupt the current task and require an explicit decision. Popovers
support a local control without taking ownership of the full task. Toasts report
transient, nonblocking feedback.

Dialogs must:

- Have an accessible title
- Move focus inside when opened and restore it when closed
- Support Escape unless work is intentionally locked during submission
- Keep the primary and cancel actions predictably placed
- Render through Chakra's `Portal` and `Dialog.Positioner`
- Keep blocking request errors in the dialog rather than only in a toast

Destructive actions use `ConfirmDialog` when its contract fits. The confirmation
names the target or consequence and does not use a vague label such as “OK.”

Popovers need a labelled trigger, keyboard dismissal, and a placement that does
not hide the value being edited. Do not put a multi-step workflow in a popover.

## Long-running ingestion and conversion

**Status:** Established

Uploads and remote ingestion can scan, pause for user input, convert, store,
register, and become ready. Present real stages through `ProgressTracker`; do
not invent percentages when the backend cannot support them.

- State what is happening in user language.
- Distinguish active work, waiting for input, recoverable warning, failure, and
  completion.
- Tell users whether they can safely leave the page.
- Preserve enough context to resume a paused mapping or variable-selection step.
- On failure, retain the source and selections where possible and offer the next
  recovery action.
- On success, lead directly to the useful result, normally the map.

Spinners are appropriate only for short gaps within the larger staged
experience.

## Save and autosave feedback

**Status:** Established

Authoring surfaces communicate `saving`, `saved`, and `error` without requiring
the user to infer state from a disabled button.

- Saving feedback should be persistent but quiet.
- Success may settle into a low-emphasis saved state.
- Failure remains visible until recovered or superseded and must not imply that
  work is safely stored.
- Navigation or publishing that risks unsaved work requires a clear warning.
- Do not use a transient toast as the only save-failure signal.

`SaveStatus` is the established presentation. Domain hooks own persistence and
must not be duplicated inside the visual component.

## Destructive actions

**Status:** Established

Destructive actions are visually secondary until the user enters the relevant
management context. The confirmation step must explain:

- The exact target
- Whether the action can be undone
- Important dependent effects
- What happens if the request fails

Disable dismissal and duplicate confirmation while the request is running.
Show request errors inside the confirmation context and keep the user able to
cancel or retry afterward.

## Map chrome and overlays

**Status:** Established principles; component consolidation remains provisional

The basemap changes continuously, so map UI must supply its own legible surface,
edge, focus state, and layering. MapLibre owns camera interaction while deck.gl
renders data overlays; visual refactoring must not change that ownership.

Rules:

- Keep controls near map edges and avoid collisions with legends, chat,
  snapshots, transport bars, and responsive panels.
- Use the `mapControl` z-index for ordinary map controls.
- Give icon-only controls an accessible name and visible tooltip.
- Selected controls differ by more than color alone.
- Legends and render metadata follow the data actually visible, not data still
  loading for a pending story scene.
- Controls included in snapshots carry the required snapshot-overlay marker.
- At narrow widths, convert side panels to an appropriate overlay rather than
  shrinking the map into a strip.
- Preserve reduced-motion alternatives for fly-to, flyover, temporal, and
  trajectory animation.

See `docs/frontend-gotchas.md` for the rendering, camera, snapshot, and
progressive-loading contracts that accompany these design rules.

## Progressive disclosure

**Status:** Established

Show the controls needed for the common next decision first. Advanced settings
should remain discoverable, retain their values when collapsed, and explain
their effect in product language.

Do not use “advanced” as a dumping ground for poorly grouped controls. Group by
task—appearance, filtering, inspection, export—before deciding which groups
need disclosure.

## Responsive transformation

**Status:** Established principle

Responsive behavior is a change in composition and priority, not merely smaller
spacing.

- Preserve the page identity and primary action.
- Stack action groups in importance order.
- Convert comparison tables into labelled rows only when the relationships
  remain understandable.
- Use drawers or sheets for dense map panels when appropriate.
- Keep touch targets around 44px where feasible.
- Test long titles, translated-length copy, errors, and loading states—not only
  ideal content.

Review 390px, 768px, 1024px, and 1440px widths as representative checkpoints.

## Story reading and progressive map loading

**Status:** Established

Story prose must become readable without waiting for the map runtime. Map,
scrollytelling, and flyover placeholders retain real narrative and reserve the
final layout dimensions so hydration does not shift the document.

Slow or data-saving connections may delay idle map-runtime download, but
proximity and user intent still promote loading. Snapshot capture follows a
separate deterministic path. Do not replace the reader with a route-level
spinner while map code loads.

## Content and terminology

**Status:** Established principles

- Prefer sentence case and direct verbs.
- Describe outcomes before implementation mechanisms.
- Say what happened, what remains intact, and what the user can do next.
- Use consistent resource terms: dataset, connection, map, story, chapter.
- Explain browser/server rendering before exposing internal render-mode names.
- Avoid success exclamation marks and vague errors such as “Something went
  wrong” when a more specific scope is known.
- Put privacy, sharing, expiry, and data-handling consequences beside the action
  they qualify.

## Adding or changing a pattern

A pattern change should include:

1. The user situation and intended outcome
2. State transitions, including failure and recovery
3. Components involved and ownership of state
4. Keyboard, focus, announcement, and reduced-motion behavior
5. Narrow-screen transformation
6. At least two concrete consumers when claiming general reuse
7. Tests for important behavioral contracts

Keep detailed rendering and API constraints in their specialist documents and
link to them. The design pattern should remain readable to both designers and
developers.
