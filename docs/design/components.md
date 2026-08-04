# Shared components

This catalogue describes reusable UI contracts that exist in production. It is
not an export index for every React component. Feature components belong here
only when contributors are expected to reuse their product and interaction
rules outside the original screen.

Component source lives primarily in `frontend/src/components/ui/`; established
cross-feature components may live directly under `frontend/src/components/`.

## Choosing the right level

Use, in order:

1. A Chakra primitive when no product-specific behavior or styling contract is
   needed.
2. A Chakra primitive using the central token, text-style, or recipe vocabulary.
3. An established shared component below when its complete contract applies.
4. A feature component for domain-specific behavior.

Do not create a shared wrapper merely to shorten Chakra syntax. Shared
components should encode product semantics, accessibility behavior, responsive
composition, or a meaningful set of supported states.

## Established primitives

### Chakra Button

**Status:** Established through the central recipe

**Source:** `frontend/src/theme.ts`

The central button recipe supplies consistent sizes, focus, disabled, hover,
pressed, and loading-compatible styling.

Variants:

- `solid` — the primary forward action
- `subtle` — a quiet filled alternative
- `surface` — a raised or map-adjacent surface action
- `outline` — a secondary action
- `ghost` — navigation or a low-emphasis utility
- `plain` — an inline action where button chrome would add noise

Use no more than one visually primary action in a local decision group. A
destructive action uses danger semantics and must name or clearly identify its
target; it is not currently a general button recipe variant.

### Chakra Input

**Status:** Established through the central recipe

**Source:** `frontend/src/theme.ts`

Variants are `outline`, `subtle`, and `flushed`. The recipe establishes height,
focus, invalid, placeholder, and disabled behavior. Labels, hints, and errors
remain the responsibility of the containing field composition.

Use the invalid state together with explanatory text. Do not communicate an
error by border color alone.

### PageHeader

**Status:** Established

**Source:** `frontend/src/components/PageHeader.tsx`

Provides a responsive page title, description, and optional action group. The
description is required because the component represents application-page
orientation, not a generic heading.

Use it for top-level collection and task pages. Do not use it inside dialogs,
cards, or map panels. Actions should be ordered by importance and must remain
understandable when they wrap below the heading on narrow screens.

### StatePanel

**Status:** Established

**Source:** `frontend/src/components/ui/StatePanel.tsx`

Communicates a bounded neutral, information, success, warning, or danger state.
It supports a title, description, icon, compact presentation, and one action
area.

Use it for empty results, recoverable request failures, unsupported states,
important guidance, or a scoped status. Danger uses an alert role; other tones
use status semantics. Keep the title concise and make recovery actions specific
such as “Try again” or “Choose another dataset.”

Do not use it for passive metadata, routine helper text, transient success that
belongs in a toast, or long multi-step content.

### ConfirmDialog

**Status:** Established for destructive confirmation

**Source:** `frontend/src/components/ui/ConfirmDialog.tsx`

Provides an alert dialog with title, description, cancel and destructive
actions, loading protection, and inline error feedback. It prevents dismissal
while the destructive request is running.

Use it when an action deletes or irreversibly changes a meaningful resource.
Name the affected resource or consequence in the title or description. Do not
use it for ordinary acknowledgment, information, or a reversible navigation
choice.

### ResourceCollection family

**Status:** Established

**Source:** `frontend/src/components/ui/ResourceCollection.tsx`

`ResourceCollection`, `ResourceCollectionRow`, and `ResourceCollectionCell`
provide a responsive dense collection: column headers on desktop and labelled,
stacked cells on small screens.

Use the family for repeated work objects that benefit from comparison across
consistent metadata fields. Use a card or preview pattern when imagery or
individual browsing is more important than comparison.

The family uses semantic surface, border, and text roles. Preserve the labelled
small-screen cells when adapting its visual presentation.

### ResourceThumbnail

**Status:** Provisional

**Source:** `frontend/src/components/ui/ResourceThumbnail.tsx`

Displays the visual identity of a dataset, story, or similar work object. Prefer
real output imagery. Fallbacks should remain quieter than actual maps or
previews. Supply useful alternative text when the image conveys information;
mark it decorative when adjacent text communicates the same content.

### CollectionSkeleton

**Status:** Established for collection loading

**Source:** `frontend/src/components/ui/CollectionSkeleton.tsx`

Reserves the shape of a loading resource collection. Use it only where its rows
resemble the eventual content. A skeleton that does not approximate the final
layout creates avoidable reflow and misleading expectations.

### BrandSpinner

**Status:** Established for compact indeterminate work

**Source:** `frontend/src/components/ui/BrandSpinner.tsx`

Use for short, localized operations when the final layout cannot be represented
by a skeleton and meaningful stage information is not available. Provide nearby
status text when the reason for waiting is not already obvious.

Do not use an indefinite spinner for ingestion and conversion workflows that
can report real stages; use the progress pattern instead.

### Toaster

**Status:** Established infrastructure

**Sources:** `frontend/src/lib/toaster.ts`,
`frontend/src/components/ui/toaster.tsx`

The toaster is mounted once in `App.tsx`. Call the shared singleton; never
create another toaster instance.

Use toasts for transient confirmation or nonblocking feedback after the user
already has enough context to continue. Do not put required decisions,
recoverable form errors, or durable state only in a toast.

## Established feature-facing components

These components are reusable in a narrower product context:

| Component                                 | Status             | Contract                                                                                       |
| ----------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `SaveStatus`                              | Established        | Quietly communicates saved, saving, and save-failure state in authoring flows                  |
| `ProgressTracker`                         | Established        | Presents real ingestion/conversion stages without inventing precision                          |
| `RenderModeIndicator`                     | Established        | Explains browser/server rendering and fallback reasons consistently across map and story views |
| `SnapButton`                              | Established        | Starts map snapshot capture and reports capture/error state                                    |
| `ShareButton` / `ShareDialog`             | Established        | Exposes share actions and their access semantics                                               |
| `AdvancedSettingsDisclosure`              | Provisional        | Hides specialist controls without making them undiscoverable                                   |
| `TrajectoryControls` / `TemporalControls` | Provisional family | Playback, speed, range, and scrub interactions for time-aware data                             |

Before generalizing one of these, preserve its existing behavior and tests. Do
not move map or data logic into a visual primitive solely to make file placement
look tidier.

## Component contribution checklist

Before declaring a new component shared, document or test:

- Its responsibility and non-goals
- At least two concrete consumers, unless it centralizes critical accessibility
  or infrastructure behavior
- Supported variants and sizes
- Loading, empty, error, disabled, and long-content states where relevant
- Focus, keyboard, and accessible-name behavior
- Narrow-screen composition
- Whether it accepts arbitrary styling overrides and why
- The migration path from any component it replaces

Remove a superseded component only after its consumers migrate and tests show
equivalent behavior.
