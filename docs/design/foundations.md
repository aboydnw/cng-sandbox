# Design foundations

These foundations describe the current production system in
`frontend/src/theme.ts` and `frontend/src/styles.css`. They are the default for
new interface work. Data visualization colors, third-party rendering, and
deliberately distinct product areas may require scoped exceptions.

## Product character

CNG Sandbox is a **warm geospatial workbench**: capable, map-led, quietly
technical, and approachable. The interface supports the work while maps and
data provide the visual emphasis.

Prefer:

- Clear user intent over internal implementation terminology
- Real maps and output previews over decorative graphics
- Stable hierarchy and whitespace over unnecessary containers
- Progressive disclosure over showing every expert control at once
- Consistency and accessibility over novelty

Avoid generic blue or purple SaaS styling, decorative gradients, card grids for
every type of content, and infrastructure terminology presented as primary
product language.

## Color

### Token layers

The theme contains two kinds of color name:

1. **Brand tokens** hold recognizable palette values such as `brand.orange`
   and `brand.brown`.
2. **Semantic tokens** describe a UI role such as `action.primary`, `fg.muted`,
   or `status.warning.border`.

New reusable UI should normally consume semantic tokens. Brand tokens are
appropriate when the brand identity itself is the intent, for example a logo
accent. Literal values are appropriate for data-driven colors, user-selected
colors, basemap previews, canvas/WebGL APIs that cannot consume CSS variables,
and documented exceptions.

### Established semantic colors

| Role                | Tokens                                                         | Use                                                      |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Canvas and surfaces | `bg`, `bg.subtle`, `bg.raised`, `bg.emphasized`, `bg.muted`    | Page canvas, panels, menus, selected or subdued regions  |
| Text                | `fg`, `fg.muted`, `fg.subtle`, `fg.placeholder`, `fg.disabled` | Primary through disabled text hierarchy                  |
| Separation          | `border`, `border.subtle`, `border.emphasized`                 | Dividers, field edges, stronger interactive boundaries   |
| Primary action      | `action.primary`, `action.primaryHover`, `action.onPrimary`    | Main forward actions and active emphasis                 |
| Focus               | `focus.ring`, `focus.subtle`                                   | Keyboard focus outline and focus halo                    |
| Status              | `status.{success,warning,danger,info}.{fg,subtle,border}`      | Status text, tinted background, and border used together |
| Map chrome          | `map.controlBorder`                                            | Edges that must remain legible over changing map content |

Orange communicates action, selection, or an important product highlight. It
should not be added merely to make a section more colorful. Status colors
communicate their named state and should not replace the primary action color.

Do not introduce Chakra palette values such as `blue.500` or `gray.600` into a
new shared component. If the needed semantic role is missing, propose a token.
Existing uses are candidates for the design audit, not precedent.

Color alone must not be the only way to communicate selection, error, success,
or another meaningful state. Pair it with text, an icon, shape, border, or
position as appropriate.

## Typography

Satoshi Variable is the body and heading family, loaded locally from
`frontend/public/fonts/Satoshi-Variable.woff2`. The supported weight range is
300–900; the named theme weights are regular (400), medium (500), semibold
(600), and bold (700).

Use the established text styles instead of reconstructing important hierarchy
with local font sizes:

| Style          | Intended use                                                 |
| -------------- | ------------------------------------------------------------ |
| `display`      | A rare, prominent product statement such as the landing hero |
| `pageTitle`    | The primary identity of an application page                  |
| `sectionTitle` | A major group within a page                                  |
| `cardTitle`    | A selectable object, panel, or compact content title         |
| `body`         | Instructions and narrative copy                              |
| `label`        | Field labels and compact control labels                      |
| `metadata`     | Type, time, size, status, and supporting facts               |

Additional rules:

- Prefer sentence case.
- Keep explanatory prose around 60–70 characters per line when layout permits.
- Do not use important interface text below 12px.
- Use balanced wrapping for headings and natural wrapping for prose; the global
  stylesheet enables these defaults.
- Use tabular figures for coordinates, file sizes, feature counts, timestamps,
  progress, and other values that must align or update without visual jitter.
- Monospace is for code, queries, identifiers, or aligned technical values—not
  a general signal that a feature is advanced.

## Spacing and layout

Chakra's spacing scale is the established unit system. Prefer tokenized numeric
spacing props (`gap={3}`, `p={4}`) over pixel literals. Optical adjustments of
one or two pixels are acceptable for icon and text alignment when documented by
the component rather than repeated by consumers.

Layout principles:

- Maintain a stable page-header anatomy: title and description, then actions.
- Constrain prose independently from the maximum page width.
- Use lists or rows for dense repeated work objects and cards for featured or
  strongly visual objects.
- Keep map controls near map edges and preserve a quiet central viewport.
- At narrow widths, stack actions by importance and transform complex panels
  rather than compressing maps or controls into unusable space.
- Treat 390px, 768px, 1024px, and 1440px as useful review widths, not as promises
  of device-specific layouts.

## Shape and depth

Two application radii are established:

- `control` (8px) for buttons, inputs, compact controls, and menus
- `panel` (12px) for panels, dialogs, and larger cards

Use a full radius only when the pill or circular shape conveys something, such
as status, avatar, or an icon-only control. Do not create page-local radius
scales.

The `xs`, `sm`, `md`, and `lg` shadows use warm neutral color. Use depth
sparingly:

- Page canvas and content sections normally need no shadow.
- Selectable objects generally use a quiet border and interaction state.
- Map overlays, menus, dialogs, and other genuinely raised surfaces may use a
  shadow.
- Avoid combining a strong border and a strong shadow.

## Interaction and motion

The established motion tokens are:

- `fast` — 180ms for hover, press, selection, and small disclosures
- `moderate` — 240ms for ordinary component transitions
- `slow` — 340ms for panels or larger layout changes
- `out` — the shared `cubic-bezier(0.32, 0.72, 0, 1)` easing

Buttons and inputs share transitions for background, border, color, shadow,
transform, and opacity. Primary buttons may rise slightly on hover and compress
slightly when pressed. Do not make decorative motion compete with map fly-to,
trajectory playback, temporal animation, or scrollytelling.

The global stylesheet honors `prefers-reduced-motion: reduce` by removing smooth
scrolling and reducing transitions and animations. Feature code with continuous
or imperative animation must provide its own reduced-motion behavior where a
global CSS override cannot do so.

## Layering

Use the named z-index tokens rather than arbitrary large numbers:

| Token        | Purpose                                |
| ------------ | -------------------------------------- |
| `base`       | Normal page content                    |
| `sticky`     | Sticky page navigation or content      |
| `mapControl` | Controls and information over the map  |
| `overlay`    | Drawers, scrims, and nonmodal overlays |
| `modal`      | Dialogs and blocking modal surfaces    |
| `toast`      | Toasts and the skip link when focused  |

Portalled UI still needs the correct token. Chakra dialogs must use `Portal` and
`Dialog.Positioner`; see `ConfirmDialog` and `docs/frontend-gotchas.md`.

## Icons

Use `@phosphor-icons/react` for interface icons whenever an appropriate
Phosphor icon exists.

- Do not use emoji as interface icons.
- Do not add a custom SVG for a standard action already represented by
  Phosphor.
- Match icon weight and size to nearby established controls.
- Decorative icons must be hidden from assistive technology.
- Icon-only controls require an accessible name and usually a tooltip.
- Do not rely on an icon alone when the action or state is unfamiliar.

Logos, data visualization marks, generated previews, and cartographic symbols
are not interface icons and may use other assets.

## Accessibility baseline

The working target is WCAG 2.2 AA. Automated checks can assist but do not replace
keyboard, screen-reader, zoom, contrast, and reduced-motion review.

Established expectations include:

- Semantic HTML and native controls before custom roles
- A visible, consistent `:focus-visible` treatment
- Logical keyboard order and focus restoration for overlays
- Text or accessible names for controls
- Error text associated with the relevant task and announced when blocking
- Sufficient contrast over both fixed surfaces and variable basemaps
- Touch targets around 44px where feasible
- Usability at browser zoom and narrow widths
- Reduced-motion behavior for nonessential animation
- A skip link to bypass repeated navigation

Maps require special care. Controls must be keyboard operable, map status must
not rely exclusively on visual canvas content, and essential information should
have a textual path when possible.

## Exceptions

An exception is valid when the value represents data, user authorship, an
external rendering API, or a deliberately scoped visual language. Record:

1. Where the exception applies
2. Why the core system is insufficient
3. Whether it can spread to new consumers
4. What would trigger reconsideration

The Discover pages currently contain a distinct editorial treatment and several
local color and type constants. Their final classification is part of the next
design-system audit. Until then, do not copy those choices into other product
areas or mechanically replace them without reviewing their intent.
