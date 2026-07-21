# Component migration inventory

This inventory maps current frontend surfaces to the shared patterns needed for
the design-polish work. Names are conceptual; exact component names should be
chosen during implementation to fit the existing code structure.

## Shared patterns to establish first

| Shared pattern | Responsibility | Initial consumers |
|---|---|---|
| Page shell | Canvas, content width, responsive gutters, footer placement | Landing, workspace home, Data, Stories, About, Discover |
| Page header | Context/back action, title, description, primary and secondary actions | Workspace home, Data, Stories, Upload, map detail, story editor |
| Navigation link | Active, hover, focus, compact/mobile behavior | `Header` |
| Button recipes | Primary, secondary, quiet, destructive, icon-only states | All pages and dialogs |
| Field recipes | Label, hint, validation, disabled and loading states | Upload/connect, editor forms, filters, dialogs |
| Work preview | Thumbnail, title, type, status, time, primary interaction | Workspace home, Stories, Data, landing examples |
| Collection row | Dense title/meta presentation with accessible row actions | Data, Stories, workspace recent items |
| State panel | Empty, error, permission, unsupported, expired variants | Collection pages, map, editor, dialogs |
| Skeleton family | Page header, preview card, collection row, map panel | Landing, home, Data, Stories, Explore |
| Status notice | Informational, warning, success, blocking error | Conversion, publishing, sharing, render eligibility |
| Panel header | Title, current state, close/collapse, reset/help | Map side panel, Explore, raster/vector/COPC controls |
| Map control | Consistent size, surface, shadow, focus, tooltip, selected state | Basemap, snapshot, inspect, chat, zoom prompt |

## Existing surface mapping

### Global shell

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `theme.ts` | Brand tokens stop short of a complete semantic system | Add semantic colors, type roles, radius/shadow/interaction recipes | 1 |
| `styles.css` | Only foundational reset and animation rules | Add global focus, wrapping, numeric, reduced-motion, and skip-link rules | 1 |
| `Header.tsx` | No active navigation; workspace ID has excessive prominence | Active links, primary action slot, simpler workspace identity, responsive menu | 2 |
| `Footer.tsx` | Functional but visually detached from page hierarchy | Align content width and simplify supporting links | 2 |
| `ErrorBoundary.tsx` | Separate styling language and generic recovery | Adopt shared blocking-state pattern with retry/home/report routes | 1–2 |

### Landing and workspace discovery

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `LandingPage.tsx` | Centered marketing template and equal-weight sections | Asymmetric map-led hero, featured example, quieter utilities | 3 |
| `ExampleStoryCard.tsx` | Hash-derived gradient reads as placeholder imagery | Real snapshot with intentional format-specific fallback | 3 |
| `WorkspaceHomePage.tsx` | Administrative title and text-only recent rows | Continue-working focus, visual previews, grouped creation actions | 4 |
| `HomepageHero.tsx` | Small generic claim; may overlap with newer landing patterns | Consolidate or retire after hero direction is implemented | 3 |
| `PathCard.tsx` | Three equal paths and large expansion behavior can feel templated | Reframe paths by user intent; keep accessible expansion if retained | 3 or 5 |

### Data and stories collections

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `DataPage.tsx` | Table hierarchy, loading, and actions feel utilitarian | Shared page header, collection rows, skeletons, composed state panels | 4 |
| `StoriesPage.tsx` | Needs common preview and state language with Data | Shared work previews/rows and explicit example grouping | 4 |
| `ExampleDataToggle.tsx` | Example ownership can be difficult to understand | Plain-language explanation and clear on/off consequences | 4 |
| `ExpiryBadge.tsx` | Status is isolated from broader item metadata | Move into shared status treatment | 4 |
| `EditableDatasetTitle.tsx` | Inline editing can hide affordance and failure | Standard inline-edit focus, save, error, and cancel behavior | 4 |

### Upload, connect, and conversion

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `UploadPage.tsx` | Multiple paths need clearer intent and progression | Intent-led path selection with stable progress region | 5 |
| `FileUploader.tsx` | Incomplete visible format list and ambiguous nested click target | Group formats, one clear action model, file preview and recovery copy | 5 |
| `VisualizeDataCardContent.tsx` | URL language exposes detection mechanics | Outcome-first labels and visible detection result | 5 |
| `RemoteConnectFlow.tsx` | Technical phases and errors dominate the flow | User-facing stages, recoverable inline errors, advanced details disclosure | 5 |
| `ProgressTracker.tsx` | Stage display is useful but not yet a full trust experience | Add remaining-stage context, leave-page guidance, warning distinction | 5 |
| `ConversionSummaryCard.tsx` | Summary is visually separate from the next task | Integrate into success handoff to map | 5 |
| `ColumnPicker.tsx` / `VariablePicker.tsx` | Selection screens use locally styled cards | Shared selectable-row/card pattern and validation | 5 |

### Map workspace

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `MapPage.tsx` | Many capabilities compete in one visual plane | Stable shell regions and progressive disclosure; no rendering rewrite | 6 |
| `MapSidePanel.tsx` | Needs consistent task grouping and responsive behavior | Shared panel anatomy; desktop panel and mobile drawer/sheet | 6 |
| `MapShell.tsx` basemap picker | Color-only swatches and title-only labels | Preview plus text/accessible selection state | 6 |
| `RasterSidebarControls.tsx` | Basic and expert controls compete | Put common appearance controls first; disclose advanced values | 6 |
| `VectorSidebarControls.tsx` | Dense control collection | Group by appearance, filtering, and inspection | 6 |
| `CopcControls.tsx` | Separate specialty styling risk | Use the same panel/control recipes as other layer types | 6 |
| `TemporalControls.tsx` / `TrajectoryControls.tsx` | Transport controls need a common visual grammar | Shared transport layout, numeric alignment, mobile treatment | 6 |
| `ExploreTab.tsx` | Spinner, implementation terminology, dense stats | Skeleton, “Explore data” language, grouped filters and results | 6 |
| `SnapButton.tsx`, `ShareButton.tsx`, chat entry | Floating controls vary by component | Shared map-control recipe and collision/priority rules | 6 |
| Legends and popups | Multiple visual sources | Harmonize surface, type, spacing, and dismissal behavior | 6 |

### Story editing and publishing

| Current surface | Primary issue | Target change | Work package |
|---|---|---|---|
| `StoryEditorPage.tsx` | Editing, preview, save, and publish compete | Strong authoring shell and action hierarchy | 7 |
| `ChapterList.tsx` | Chapter structure and selection need stronger hierarchy | Clear selected, complete, warning, drag, and add states | 7 |
| `ChapterTypePicker.tsx` | Types risk appearing as equal generic cards | Group by storytelling purpose and show concise previews | 7 |
| `NarrativeEditor.tsx` | Numerous local labels and controls | Shared field patterns and progressive advanced settings | 7 |
| Chapter-specific editors | Different content types may feel unrelated | Common editor frame with type-specific interior controls | 7 |
| `SaveStatus.tsx` | Small status can be overlooked | Persistent but quiet saved/saving/error communication | 7 |
| `PublishDialog.tsx` | Warnings are useful but need stronger prioritization | Readiness summary, blocking vs advisory issues, clear publish outcome | 7 |
| Export/share dialogs | Closely related actions use separate patterns | Shared outcome, privacy, progress, and copy-link conventions | 7 |

## Migration rules

- Introduce a shared pattern only when at least two concrete consumers are ready
  to use it. Avoid building an abstract component library in isolation.
- Preserve component props and tests when a visual wrapper is sufficient.
- Prefer Chakra recipes and semantic tokens for repeated styling; keep
  data-specific logic inside existing feature components.
- Do not couple map rendering state to panel presentation state.
- Replace local styles incrementally. A work package should not include a
  repository-wide mechanical rewrite unless it is required for consistency.
- When an existing component is superseded, remove it only after all consumers
  migrate and tests demonstrate equivalent behavior.

## Recommended first consumers

Use these pairings to prove new patterns before wider adoption:

1. Page header: Data and Stories.
2. Work preview: landing examples and workspace recent stories.
3. Collection row: recent data and the Data library.
4. State panel: Data fetch error and empty Stories.
5. Skeleton: landing story cards and workspace recent items.
6. Panel header: raster controls and Explore.
7. Map control: basemap picker and snapshot action.
