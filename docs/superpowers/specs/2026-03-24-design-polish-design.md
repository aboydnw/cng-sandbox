# Design Polish: Taste-Skill-Informed UI Refinements

**Date:** 2026-03-24
**Status:** Draft
**Scope:** Frontend only — no backend or API changes

## Context

The CNG Sandbox frontend works well functionally but uses default system fonts, emoji icons, generic easing curves, and lacks complete interaction states. Informed by the [taste-skill](https://github.com/Leonxlnx/taste-skill) design principles, this spec defines a set of visual refinements that elevate the app from "functional prototype" to "polished tool."

Mobile-specific design is explicitly out of scope — it will be tackled separately if needed.

## Approach

**Theme-first (Approach A):** Centralize design tokens (font, easing, shadows) in `theme.ts` so changes propagate app-wide. Then handle per-component work (icons, interaction states) in focused passes.

## Section 1: Typography — Satoshi

### Changes

- Add `@fontsource-variable/satoshi` as an npm dependency
- Import it in the app entry point (e.g. `main.tsx`)
- Set as the default font in `theme.ts` via Chakra's `fonts` token:
  - `body` → `"Satoshi Variable", sans-serif`
  - `heading` → `"Satoshi Variable", sans-serif`

### Typography refinements

- Headlines: tighter tracking (`letterSpacing: "-0.02em"`)
- Body text: max line length ~65ch where applicable (`maxW: "65ch"`)
- Keep existing font-size scale — it's already reasonable

### No per-component changes needed

Chakra propagates fonts from the theme. All existing `Text`, `Heading`, and other text-rendering components will pick up Satoshi automatically.

## Section 2: Shadows & Easing

### Shadows — soft and diffused

Replace Chakra's default shadow tokens in `theme.ts`:

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | `0 1px 3px rgba(0,0,0,0.04)` | Resting cards |
| `md` | `0 4px 24px rgba(0,0,0,0.06)` | Hover states |
| `lg` | `0 8px 40px rgba(0,0,0,0.08)` | Modals/overlays |

Design principle: huge blur radius, very low opacity. Shadows suggest depth without drawing attention.

### Easing — custom cubic-bezier

Define a shared easing value as a CSS custom property and an exported constant:

```
--ease-out-expo: cubic-bezier(0.32, 0.72, 0, 1)
```

This curve starts fast, decelerates smoothly. Feels more intentional than generic `ease-out`.

### Transition rules

- **Only animate `transform` and `opacity`.** No `flex`, `border-color`, `box-shadow`, or `background-color` in transition strings.
- Replace all `"all Xms ease-out"` patterns with targeted property lists:
  - e.g. `transition: "transform 300ms var(--ease-out-expo), opacity 300ms var(--ease-out-expo)"`

### PathCard flex animation refactor

The PathCard currently animates `flex` to expand/collapse. To comply with the transform-only rule, this needs to switch to a different approach — likely fixed widths with `transform`-based sizing, or `scaleX()`. This is the most complex single refactor and may need visual iteration.

## Section 3: Phosphor Icons

### Changes

- Add `@phosphor-icons/react` as an npm dependency
- Replace every emoji usage with a Phosphor icon component

### Icon mapping

| Location | Current | Replacement |
|----------|---------|-------------|
| PathCard — file upload | `📁` emoji string | `<FolderOpen>` |
| PathCard — story/map | `🗺` emoji string | `<GlobeHemisphereWest>` |
| PathCard — URL convert | `📖` or similar | `<LinkSimple>` |
| Upload drop zone | `📁` (40px) | `<CloudArrowUp size={40}>` |
| Progress stages — done | `✓` text | `<Check>` |
| Progress stages — error | `✕` text | `<X>` |
| Back button | `←` text | `<ArrowLeft>` |
| CTA arrows | `→` text | `<ArrowRight>` |
| Share button — copied | `✓` text | `<Check>` |
| New upload button | `+` text | `<Plus>` |

### Interface change

PathCard's `icon` prop changes from `string` to `ReactNode`. Parents pass `<FolderOpen size={36} />` instead of `"📁"`. This is a breaking change to the component API but it's only used internally.

### Icon style

- Default weight: `"regular"` (matches the app's clean aesthetic)
- Small sizes (under 20px): `"bold"` weight where stroke detail would otherwise be lost

## Section 4: Interaction States

Every interactive element gets all six states. All state transitions use the custom easing curve and only animate `transform` + `opacity`.

### Shared infrastructure

Define reusable style objects in `src/lib/interactionStyles.ts` so components stay DRY. This file exports Chakra-compatible style objects for common patterns (button press, card hover, focus ring, etc.).

### Buttons (primary & secondary)

| State | Behavior |
|-------|----------|
| Hover | `translateY(-1px)`, background color shift |
| Active/pressed | `scale(0.98)`, `translateY(0)` — tactile push |
| Focus | Visible focus ring using `brand.orange` at 40% opacity |
| Loading | Text replaced with Phosphor `<SpinnerGap>` rotating via CSS `@keyframes`, button disabled |
| Disabled | `opacity: 0.5`, `pointerEvents: "none"` (existing, keep) |

### Cards (PathCard, TechCard, dataset cards)

| State | Behavior |
|-------|----------|
| Hover | `translateY(-2px)` + soft shadow (`md` token) |
| Active/pressed | `scale(0.985)` — subtle squeeze |
| Focus | Focus ring for keyboard navigation |
| Empty | Dedicated empty-state component: muted icon + short message (e.g. "No datasets yet") |
| Error | Inline error banner with `<WarningCircle>` icon, warm red text, no harsh red backgrounds |

### Upload drop zone

| State | Behavior |
|-------|----------|
| Hover | Border color shifts to `brand.orange`, background lightens |
| Active/dragging | Border goes solid (dashed→solid), `scale(0.99)` inward |
| Loading/uploading | Progress bar replaces drop zone content |
| Error | Inline message below drop zone with `<WarningCircle>` |

## Out of Scope

- Mobile/responsive design — deferred to a separate effort
- Color palette changes — the existing brand tokens are solid
- New components or features — this is purely a polish pass
- Backend or API changes
