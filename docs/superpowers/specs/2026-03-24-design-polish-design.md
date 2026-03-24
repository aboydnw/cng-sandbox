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

### Font loading

Satoshi is distributed via [fontshare.com](https://fontshare.com), not Fontsource. Self-host the font files:

1. Download Satoshi Variable (woff2) from Fontshare
2. Place in `frontend/public/fonts/Satoshi-Variable.woff2`
3. Add `@font-face` declaration in `styles.css`:
   ```css
   @font-face {
     font-family: "Satoshi Variable";
     src: url("/fonts/Satoshi-Variable.woff2") format("woff2");
     font-weight: 300 900;
     font-display: swap;
   }
   ```
4. Set as the default font in `theme.ts` via Chakra v3 token syntax:
   ```ts
   tokens: {
     fonts: {
       body: { value: '"Satoshi Variable", sans-serif' },
       heading: { value: '"Satoshi Variable", sans-serif' },
     },
     // ... existing color tokens
   }
   ```

### Typography refinements

- Headlines: tighter tracking (`letterSpacing: "-0.02em"`). Since some components use `Text` with manual font weight instead of `Heading` (e.g. HomepageHero), the tracking must be applied manually in those components — it cannot be set via a theme-level Heading recipe alone.
- Body text: max line length ~65ch where applicable (`maxW: "65ch"`)
- Keep existing font-size scale — it's already reasonable

### No per-component font changes needed

Chakra propagates fonts from the theme. All existing `Text`, `Heading`, and other text-rendering components will pick up Satoshi automatically. Only `letterSpacing` on headline-styled `Text` components requires manual updates.

## Section 2: Shadows & Easing

### Shadows — soft and diffused

Replace Chakra's default shadow tokens in `theme.ts`:

```ts
tokens: {
  shadows: {
    sm: { value: "0 1px 3px rgba(0,0,0,0.04)" },
    md: { value: "0 4px 24px rgba(0,0,0,0.06)" },
    lg: { value: "0 8px 40px rgba(0,0,0,0.08)" },
  },
  // ... existing tokens
}
```

Design principle: huge blur radius, very low opacity. Shadows suggest depth without drawing attention.

### Easing — custom cubic-bezier

Define a shared easing value as a CSS custom property (in `styles.css`) and an exported TypeScript constant (in `src/lib/interactionStyles.ts`):

```
--ease-out-expo: cubic-bezier(0.32, 0.72, 0, 1)
```

```ts
export const EASE_OUT_EXPO = "cubic-bezier(0.32, 0.72, 0, 1)";
```

This curve starts fast, decelerates smoothly. Feels more intentional than generic `ease-out`.

### Transition rules

- **Only animate `transform` and `opacity`.** No `flex`, `border-color`, `box-shadow`, or `background-color` in transition strings.
- Replace all `"all Xms ease-out"` patterns with targeted property lists:
  - e.g. `transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms cubic-bezier(0.32, 0.72, 0, 1)"`

### Known transition locations to update

| File | Current | Notes |
|------|---------|-------|
| `PathCard.tsx:16` | `"all 300ms ease-out"` | Also needs flex animation refactor (see below) |
| `ConversionSummaryCard.tsx:33` | `"all 200ms ease-out"` | Standard card transition |
| `SidePanel.tsx:59` | `"all 200ms ease-out"` | Standard transition |
| `StoryCTABanner.tsx:56` | `"all 200ms ease-out"` | Standard card transition |
| `ShareButton.tsx:19` | `"transform 300ms ease, opacity 250ms ease"` | Already transform/opacity-only — just update the curve |
| `StoryEditorPage.tsx:467` | `"background 0.3s"` | Violates transform-only rule — refactor to use opacity or remove |

### PathCard flex animation

The PathCard currently animates `flex` to expand/collapse. `scaleX()` is not viable because scale does not affect layout flow — siblings would not reposition.

**Accepted exception:** PathCard's flex animation is exempt from the transform-only rule. The `flex` property transition is kept because the alternatives (CSS grid column transitions, JS-calculated pixel widths with transforms) add significant complexity for a single component. The easing curve will still be updated to the custom cubic-bezier.

## Section 3: Phosphor Icons

### Changes

- Add `@phosphor-icons/react` as an npm dependency
- Replace every emoji and text-character icon with a Phosphor icon component

### Blanket rule

All `→`, `←`, `✕`, `×`, `✓`, `+` text characters used as icons across all components are replaced with the corresponding Phosphor component. **Exception:** `→` characters used as textual separators in pipeline visualizations (e.g. ReportCard transformation bar) are kept as text — they function as punctuation, not icons. The table below is comprehensive but if any icon-like usages are discovered during implementation, apply the same pattern.

### Icon mapping

| Location | Current | Replacement |
|----------|---------|-------------|
| PathCard — file upload | `📁` emoji string | `<FolderOpen>` |
| PathCard — story/map | `🗺` emoji string | `<GlobeHemisphereWest>` |
| PathCard — URL convert | `📖` or similar | `<LinkSimple>` |
| Upload drop zone | `🗺` (40px) | `<CloudArrowUp size={40}>` |
| Progress stages — done | `✓` text | `<Check>` |
| Progress stages — error | `✕` text | `<X>` |
| PathCard back button | `←` text | `<ArrowLeft>` |
| PathCard CTA arrows | `→` text | `<ArrowRight>` |
| ShareButton — share label | `🔗 Share` | `<LinkSimple>` |
| ShareButton — copied | `✓` text | `<Check>` |
| SidePanel — new upload | `+` SVG | `<Plus>` |
| StoryEditorPage — capture view | `📍` / `✓` | `<MapPin>` / `<Check>` |
| NarrativeEditor — draft with AI | `✨` | `<Sparkle>` |
| NarrativeEditor — add | `+ Add` | `<Plus>` |
| ReportCard — close | `✕` text | `<X>` |
| VectorPopup — dismiss | `✕` text | `<X>` |
| StoryReaderPage — back | `← Back to sandbox` | `<ArrowLeft>` |
| InlineUpload — back | `← Back` | `<ArrowLeft>` |
| ChapterList — delete chapter | `×` text | `<X>` |
| ChapterList — add chapter | `+ Add chapter` | `<Plus>` |
| ConversionSummaryCard — details | `Details →` | `<ArrowRight>` |
| StoryCTABanner — create story | `Create story →` | `<ArrowRight>` |
| TechCard — view repo | `View repo ↗` | `<ArrowSquareOut>` |

### Spinner replacement

Existing Chakra `<Spinner>` usages in `ProgressTracker.tsx` and `ExploreTab.tsx` are replaced with Phosphor `<SpinnerGap>` rotating via CSS `@keyframes` for visual consistency across all loading indicators.

### Interface change

PathCard's `icon` prop changes from `string` to `ReactNode`. Parents pass `<FolderOpen size={36} />` instead of `"📁"`. This is a breaking change to the component API but it's only used internally.

### Icon style

- Default weight: `"regular"` (matches the app's clean aesthetic)
- Small sizes (under 20px): `"bold"` weight where stroke detail would otherwise be lost

## Section 4: Interaction States

Every interactive element gets all six states. All state transitions use the custom easing curve and only animate `transform` + `opacity`.

### Shared infrastructure

Define reusable style objects in `src/lib/interactionStyles.ts`. Exports:

```ts
export const EASE_OUT_EXPO = "cubic-bezier(0.32, 0.72, 0, 1)";

// Chakra-compatible style objects
export const cardHover: SystemStyleObject;    // translateY(-2px) + md shadow
export const cardActive: SystemStyleObject;   // scale(0.985)
export const buttonHover: SystemStyleObject;  // translateY(-1px)
export const buttonActive: SystemStyleObject; // scale(0.98)
export const focusRing: SystemStyleObject;    // brand.orange at 40% opacity ring
export const baseTransition: string;          // "transform Xms <curve>, opacity Xms <curve>"
```

Components import these and spread them into `_hover`, `_active`, `_focusVisible` props.

### Buttons (primary & secondary)

| State | Behavior |
|-------|----------|
| Hover | `translateY(-1px)`, background color shift |
| Active/pressed | `scale(0.98)`, `translateY(0)` — tactile push |
| Focus | Visible focus ring using `brand.orange` at 40% opacity |
| Loading | Text replaced with Phosphor `<SpinnerGap>` rotating via CSS `@keyframes`, button disabled |
| Disabled | `opacity: 0.5`, `pointerEvents: "none"` (existing, keep) |

### Cards (PathCard, TechCard, dataset cards, ConversionSummaryCard, StoryCTABanner)

Existing card hover styles (e.g. `borderColor` + `shadow` in ConversionSummaryCard) are replaced with the shared `cardHover` style from `interactionStyles.ts`, which includes `translateY(-2px)` + shadow.

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

### Modals

Both `BugReportModal.tsx` (hand-rolled) and `UploadModal.tsx` (Chakra Dialog) receive the `lg` shadow token. No structural migration of BugReportModal to Chakra Dialog — that's out of scope for this polish pass.

## Out of Scope

- Mobile/responsive design — deferred to a separate effort
- Color palette changes — the existing brand tokens are solid
- New components or features — this is purely a polish pass
- Backend or API changes
- Migrating BugReportModal to Chakra Dialog system
