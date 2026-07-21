# Visual direction

## North star

**A warm geospatial workbench.** CNG Sandbox should feel precise enough for an
expert, approachable enough for a first upload, and visually grounded in the
maps and data it produces. The interface supports the work; the data supplies
the spectacle.

Three qualities should be evident on every screen:

- **Map-led:** real maps, extents, rasters, geometries, tracks, and point clouds
  are the primary imagery.
- **Quietly technical:** numbers and metadata are crisp and trustworthy, while
  implementation details appear only when useful.
- **Warm and human:** warm neutrals, direct language, optical spacing, and
  restrained motion avoid both sterile enterprise UI and flashy AI aesthetics.

## Avoid

- Purple or blue gradients used as generic decoration.
- Identical three-column marketing cards.
- Synthetic thumbnail gradients when real product imagery is available.
- A border, white background, radius, and shadow on every content group.
- Tiny uppercase labels as the primary form of hierarchy.
- Exposing infrastructure terms such as DuckDB, render paths, or workspace IDs
  before the user needs them.
- Decorative motion competing with map movement.

## Typography

Keep **Satoshi Variable** as the main family. It already gives the product more
character than a default system or Inter stack. Use weight, size, and spacing
more systematically.

| Role | Suggested treatment | Use |
|---|---|---|
| Display | 48–64px, 650–720 weight, 0.98–1.05 line-height, negative tracking | Landing statement only |
| Page title | 30–36px, 650–700, 1.1 line-height | Primary page identity |
| Section title | 20–24px, 600–650 | Major groups |
| Card title | 15–17px, 600 | Selectable objects |
| Body | 15–16px, 400–450, 1.55–1.7 line-height | Instructions and narrative |
| Label | 12–13px, 550–600, sentence case | Fields and controls |
| Metadata | 12–13px, 400–500 | Type, time, state, size |
| Data number | 22–32px, 600–700, tabular figures | Counts and measurements |

Rules:

- Limit prose to roughly 60–70 characters per line.
- Prefer sentence case. Reserve uppercase with positive tracking for rare
  eyebrow labels.
- Use `text-wrap: balance` for display headings and `text-wrap: pretty` for
  descriptions.
- Enable tabular figures for coordinates, file sizes, feature counts,
  timestamps, progress, and numeric legends.
- Avoid important text below 12px. Muted text still needs sufficient contrast.

## Color

Retain the existing orange and brown as the brand anchor. Expand them into
semantic roles so screens stop mixing warm brand values with unrelated Chakra
grays and oranges.

### Core palette

| Role | Starting value | Intent |
|---|---:|---|
| Accent | `#CF3F02` | Primary action, selection, active navigation |
| Accent hover | `#B83800` | Interactive hover |
| Ink | `#443F3F` | Primary text and dark controls |
| Canvas | `#F5F3F0` | Main application background |
| Surface | `#FCFBF9` | Panels and content areas |
| Raised surface | `#FFFFFF` | Menus, dialogs, map overlays |
| Border | `#E8E5E0` | Quiet separation |
| Muted text | `#716B68` | Secondary content, subject to contrast testing |
| Success | `#2A7D3F` | Completed and available states |

Add tested semantic tokens for danger, warning, focus, disabled content, and
map-overlay scrims. Components should consume semantic roles, not select ad hoc
palette steps.

Rules:

- Orange means action, selection, or a meaningful product highlight. Do not
  use it merely to make a section more colorful.
- Prefer one warm neutral family across the application.
- Use tinted status backgrounds with dark status text; avoid bright solid
  banners except for destructive or blocking conditions.
- Use a translucent dark scrim behind light map controls when contrast varies
  with the basemap.

## Surfaces, borders, and depth

Use containment only when it communicates structure.

| Pattern | Treatment |
|---|---|
| Page canvas | Warm neutral, no decoration |
| Content section | Spacing and an optional divider; usually no card |
| Selectable object | Surface, quiet border, clear hover and selected state |
| Instruction or empty state | Tinted surface, no elevation |
| Map panel | Opaque or near-opaque surface with a subtle edge and map-aware shadow |
| Menu/dialog | Raised white surface and stronger shadow |

Recommended radius roles:

- 4px: color chips, compact controls, inner elements.
- 8px: buttons, fields, menus, small cards.
- 12px: panels, dialogs, large cards.
- Full radius: statuses or icon buttons only when the shape has meaning.

Do not combine a strong border and a strong shadow. Shadows should be warm
tinted and suggest the same light direction.

## Layout

- Use a 1200–1280px maximum content width for primary application pages. The
  landing page may use a wider visual stage while keeping text constrained.
- Maintain stable page-header anatomy: context/back action, title and
  description, then primary actions.
- Prefer asymmetric editorial composition on the landing page: product claim
  and action beside a real product preview.
- Use lists for repeated work objects and cards for featured or visual objects.
- On the workspace home, promote one “continue working” item instead of giving
  every item equal weight.
- Keep map chrome close to map edges and maintain a quiet central viewport.
- Use progressive disclosure for expert controls rather than shrinking every
  control to fit at once.

## Product imagery

Real output is the visual identity. Use this fallback order:

1. Saved story or map snapshot.
2. Generated dataset preview: raster thumbnail, geometry extent, track trace,
   or point-cloud frame.
3. Format-specific neutral placeholder using a Phosphor icon and a subtle
   cartographic grid or contour pattern.

Never use hash-derived gradients as the normal thumbnail. Fallbacks should be
quiet enough that real imagery remains visibly more valuable.

Thumbnail rules:

- Preserve a consistent aspect ratio within a given collection.
- Add a subtle bottom scrim only when text overlays the image.
- Show source/type as metadata, not as large imagery text.
- Include useful alternative text or mark purely decorative previews as such.

## Components and interaction

### Buttons

- Primary: orange fill, reserved for the page’s main forward action.
- Secondary: warm surface or outline for meaningful alternatives.
- Quiet: text or icon treatment for navigation and low-risk utilities.
- Destructive: appears on demand and requires a clear target name.
- All variants need hover, pressed, focus, disabled, and loading states.

Avoid routinely pairing one filled and one outlined button when a text action
would create better hierarchy.

### Cards and rows

- A card must clearly communicate whether it opens, selects, expands, or edits.
- Use thumbnails for stories and datasets where available.
- Use rows for dense collections; reveal secondary actions on focus and hover
  while keeping them keyboard accessible.
- Selected state must differ by more than color alone.

### Panels

Use consistent anatomy:

1. Title and optional status.
2. One-line purpose or current selection when clarification is needed.
3. Content grouped by task.
4. Reset, help, or advanced controls in predictable secondary positions.

### Feedback states

- Skeletons should reproduce the final layout and prevent page reflow.
- Empty states should explain the state and present one primary action.
- Errors should state what failed, preserve user work, and offer retry.
- Progress should name real stages without inventing percentages.
- Success messages should be brief and confident, without exclamation marks.

## Motion

- Use 180–240ms transitions for hover, press, selection, and small disclosure.
- Use 240–360ms for panels and layout transitions.
- Prefer opacity and transform with the existing ease-out-expo curve.
- Let map fly-to and temporal animation remain the dominant motion.
- Support `prefers-reduced-motion` across shared interaction primitives.
- Never delay task completion to finish a decorative animation.

## Responsive behavior

Design each screen explicitly for four review widths:

- 1440px: wide desktop.
- 1024px: narrow desktop or landscape tablet.
- 768px: tablet.
- 390px: representative mobile.

At narrower widths:

- Collapse secondary navigation into a menu while retaining page identity and
  the primary action.
- Convert side panels to drawers or bottom sheets rather than compressing the
  map into an unusable strip.
- Convert data tables into prioritized rows only when horizontal scrolling
  would obscure the main task.
- Stack action groups in importance order.
- Keep touch targets at least 44px where feasible.

## Voice and terminology

Use plain, outcome-oriented language:

- “Add from URL,” not “Fetch.”
- “Explore data,” with DuckDB mentioned only in technical help.
- “Render in browser” and “Render on server” before internal render-mode names.
- “Create map” unless “Quick map” has already been explained.

Tell users what happens to their data, whether they can leave a conversion,
what sharing exposes, and what must be saved. Put this information beside the
relevant action.
