# Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the CNG Sandbox frontend from functional prototype to polished tool by applying taste-skill design principles — Satoshi font, Phosphor icons, custom easing, soft shadows, and full interaction states.

**Architecture:** Theme-first approach. Centralize design tokens (font, easing, shadows) in `theme.ts` and `styles.css` so changes propagate app-wide, then sweep components for icon replacements and interaction state additions. A shared `interactionStyles.ts` module provides reusable style objects so components stay DRY.

**Tech Stack:** React 19, Chakra UI v3 (`createSystem`/`defineConfig`), Vite, Phosphor Icons, Satoshi Variable font (self-hosted woff2)

**Spec:** `docs/superpowers/specs/2026-03-24-design-polish-design.md`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `frontend/public/fonts/Satoshi-Variable.woff2` | Self-hosted Satoshi variable font |
| `frontend/src/lib/interactionStyles.ts` | Shared easing constant + reusable Chakra style objects |

### Modified files
| File | Changes |
|------|---------|
| `frontend/package.json` | Add `@phosphor-icons/react` dependency |
| `frontend/src/styles.css` | `@font-face` for Satoshi, `--ease-out-expo` CSS custom property, `@keyframes spin` for SpinnerGap |
| `frontend/src/theme.ts` | Add `fonts` and `shadows` tokens |
| `frontend/src/components/PathCard.tsx` | Icon prop type `string→ReactNode`, icon swap, easing, interaction states |
| `frontend/src/components/ShareButton.tsx` | Icon swap, easing curve update |
| `frontend/src/components/ProgressTracker.tsx` | Icon swap (✓→Check, ✕→X), replace Chakra Spinner with SpinnerGap |
| `frontend/src/components/ConversionSummaryCard.tsx` | Icon swap (→), easing, interaction states |
| `frontend/src/components/StoryCTABanner.tsx` | Icon swap (→), easing, interaction states |
| `frontend/src/components/SidePanel.tsx` | Replace SVG + with Phosphor Plus, easing |
| `frontend/src/components/ReportCard.tsx` | Icon swap (✕ close button only — pipeline `→` arrows stay as text) |
| `frontend/src/components/VectorPopup.tsx` | Icon swap (✕→X) |
| `frontend/src/components/FileUploader.tsx` | Icon swap (🗺→CloudArrowUp), interaction states |
| `frontend/src/components/InlineUpload.tsx` | Icon swap (←→ArrowLeft) |
| `frontend/src/components/ChapterList.tsx` | Icon swap (×→X, +→Plus) |
| `frontend/src/components/FilterControls.tsx` | Icon swap (×→X, +→Plus) |
| `frontend/src/components/NarrativeEditor.tsx` | Icon swap (✨→Sparkle, +→Plus) |
| `frontend/src/components/TechCard.tsx` | Icon swap (↗→ArrowSquareOut), interaction states |
| `frontend/src/components/HomepageHero.tsx` | Headline letterSpacing |
| `frontend/src/pages/UploadPage.tsx` | Pass ReactNode icons to PathCard |
| `frontend/src/pages/StoryEditorPage.tsx` | Icon swap (📍→MapPin, ✓→Check), easing |
| `frontend/src/pages/StoryReaderPage.tsx` | Icon swap (←→ArrowLeft), easing curve |
| `frontend/src/components/BugReportModal.tsx` | Verify/update shadow to `lg` token |
| `frontend/src/components/UploadModal.tsx` | Verify/update shadow to `lg` token |
| `frontend/src/components/ExploreTab.tsx` | Replace Chakra Spinner with Phosphor SpinnerGap |
| `frontend/src/pages/DatasetsPage.tsx` | Replace Chakra Spinner with Phosphor SpinnerGap |
| `frontend/src/pages/MapPage.tsx` | Replace Chakra Spinner with Phosphor SpinnerGap |
| `frontend/src/components/__tests__/PathCard.test.tsx` | Update icon prop from string to ReactNode |

### Excluded from icon swap (textual, not iconic)
- `TemporalControls.tsx:86` — `{s}×` is speed notation (e.g. "2×")
- `VariablePicker.tsx:39` — `" × "` is dimension separator
- `ReportCard.tsx:123,131` — `→` arrows are pipeline separators
- `MapChapter.tsx:146` — `+` is zoom button label (native map control)

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add Phosphor Icons**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && yarn add @phosphor-icons/react
```

- [ ] **Step 2: Download Satoshi Variable font**

```bash
mkdir -p /home/anthony/projects/cng-sandbox/frontend/public/fonts
curl -L "https://api.fontshare.com/v2/fonts/download/satoshi" -o /tmp/satoshi.zip
unzip -o /tmp/satoshi.zip -d /tmp/satoshi
cp /tmp/satoshi/Fonts/WEB/fonts/Satoshi-Variable.woff2 /home/anthony/projects/cng-sandbox/frontend/public/fonts/
rm -rf /tmp/satoshi /tmp/satoshi.zip
```

If the Fontshare API URL doesn't work, download manually from https://www.fontshare.com/fonts/satoshi and extract the woff2 variable file.

- [ ] **Step 3: Verify**

```bash
ls /home/anthony/projects/cng-sandbox/frontend/public/fonts/Satoshi-Variable.woff2
cd /home/anthony/projects/cng-sandbox/frontend && yarn list @phosphor-icons/react
```

Expected: font file exists, Phosphor shows in dependency list.

- [ ] **Step 4: Commit**

```bash
cd /home/anthony/projects/cng-sandbox/frontend
git add package.json yarn.lock public/fonts/Satoshi-Variable.woff2
git commit -m "chore: add Phosphor Icons and Satoshi font"
```

---

## Task 2: Theme tokens — font, shadows

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/theme.ts`

- [ ] **Step 1: Add @font-face and CSS custom property to styles.css**

Add at the top of `frontend/src/styles.css`:

```css
@font-face {
  font-family: "Satoshi Variable";
  src: url("/fonts/Satoshi-Variable.woff2") format("woff2");
  font-weight: 300 900;
  font-display: swap;
}

:root {
  --ease-out-expo: cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Add font and shadow tokens to theme.ts**

Update the `tokens` object in `frontend/src/theme.ts`:

```ts
const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: '"Satoshi Variable", sans-serif' },
        heading: { value: '"Satoshi Variable", sans-serif' },
      },
      shadows: {
        sm: { value: "0 1px 3px rgba(0,0,0,0.04)" },
        md: { value: "0 4px 24px rgba(0,0,0,0.06)" },
        lg: { value: "0 8px 40px rgba(0,0,0,0.08)" },
      },
      colors: {
        brand: {
          orange: { value: "#CF3F02" },
          orangeHover: { value: "#b83800" },
          brown: { value: "#443F3F" },
          bgSubtle: { value: "#f5f3f0" },
          border: { value: "#e8e5e0" },
          textSecondary: { value: "#7a7474" },
          success: { value: "#2a7d3f" },
        },
      },
    },
  },
});
```

- [ ] **Step 3: Verify build**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/theme.ts
git commit -m "feat: add Satoshi font, soft shadows, and easing tokens"
```

---

## Task 3: Shared interaction styles

**Files:**
- Create: `frontend/src/lib/interactionStyles.ts`

- [ ] **Step 1: Create interactionStyles.ts**

```ts
import type { SystemStyleObject } from "@chakra-ui/react";

export const EASE_OUT_EXPO = "cubic-bezier(0.32, 0.72, 0, 1)";

export function transition(duration = 200): string {
  return `transform ${duration}ms ${EASE_OUT_EXPO}, opacity ${duration}ms ${EASE_OUT_EXPO}`;
}

export const cardHover: SystemStyleObject = {
  transform: "translateY(-2px)",
  shadow: "md",
};

export const cardActive: SystemStyleObject = {
  transform: "scale(0.985)",
};

export const buttonHover: SystemStyleObject = {
  transform: "translateY(-1px)",
};

export const buttonActive: SystemStyleObject = {
  transform: "scale(0.98) translateY(0)",
};

export const focusRing: SystemStyleObject = {
  outline: "2px solid",
  outlineColor: "rgba(207, 63, 2, 0.4)",
  outlineOffset: "2px",
};
```

- [ ] **Step 2: Verify build**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit
```

Expected: no type errors. `SystemStyleObject` is the correct type for Chakra v3's `createSystem` API. If the import fails, grep for the actual type name: `grep -r "StyleObject" node_modules/@chakra-ui/react/dist/types/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/interactionStyles.ts
git commit -m "feat: add shared interaction style utilities"
```

---

## Task 4: PathCard — icon type + interaction states

**Files:**
- Modify: `frontend/src/components/PathCard.tsx`
- Modify: `frontend/src/pages/UploadPage.tsx`
- Modify: `frontend/src/components/__tests__/PathCard.test.tsx`
- Modify: `frontend/src/components/HomepageHero.tsx`

- [ ] **Step 1: Update PathCard.test.tsx**

Change the `icon` prop from a string to a ReactNode in the test:

```tsx
import { FolderOpen } from "@phosphor-icons/react";

// In defaultProps:
icon: <FolderOpen size={36} data-testid="folder-icon" />,
```

Update the CTA assertion — the `→` text is now an inline icon, so test for the label text without the arrow:

```tsx
expect(screen.getByText("Browse files")).toBeTruthy();
```

And the faded assertion:

```tsx
expect(screen.queryByText("Browse files")).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run src/components/__tests__/PathCard.test.tsx
```

Expected: FAIL — PathCard still expects `icon: string`.

- [ ] **Step 3: Update PathCard.tsx**

Key changes:
1. Change `icon` prop type from `string` to `ReactNode`
2. Replace `←` back button with `<ArrowLeft>` from Phosphor
3. Replace `→` CTA arrow with `<ArrowRight>` from Phosphor
4. Update `TRANSITION` to use custom easing (keep `flex` in the transition for the accepted exception)
5. Add `_active` state with `scale(0.985)` for non-expanded cards
6. Add `_focusVisible` with focus ring
7. Add headline `letterSpacing: "-0.02em"` on the title

Replace the full component:

```tsx
import type { ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { EASE_OUT_EXPO, cardHover, cardActive, focusRing, transition } from "../lib/interactionStyles";

interface PathCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  expanded: boolean;
  faded: boolean;
  onCollapse?: () => void;
  children?: ReactNode;
}

// flex is an accepted exception to the transform-only rule — see spec for rationale
const TRANSITION = `flex 300ms ${EASE_OUT_EXPO}, ${transition(300)}`;

export function PathCard({
  icon,
  title,
  description,
  ctaLabel,
  onClick,
  expanded,
  faded,
  onCollapse,
  children,
}: PathCardProps) {
  return (
    <Box
      style={{
        flex: expanded ? 2.3 : faded ? 0.7 : 1,
        opacity: faded ? 0.5 : 1,
      }}
      transition={TRANSITION}
      border="2px solid"
      borderColor={expanded ? "brand.orange" : "brand.border"}
      borderRadius="16px"
      overflow="hidden"
      bg="white"
      _hover={!expanded && !faded ? cardHover : undefined}
      _active={!expanded && !faded ? cardActive : undefined}
      _focusVisible={!expanded && !faded ? focusRing : undefined}
      cursor={!expanded && !faded ? "pointer" : undefined}
      onClick={!expanded && !faded ? onClick : undefined}
      tabIndex={!expanded && !faded ? 0 : undefined}
    >
      {expanded ? (
        <Box p={5} overflow="auto" maxH="calc(100vh - 200px)">
          <Flex align="center" gap={2} mb={4}>
            {onCollapse && (
              <Box
                as="button"
                aria-label="Go back"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onCollapse();
                }}
                cursor="pointer"
                fontSize="18px"
                color="brand.textSecondary"
                _hover={{ color: "brand.brown" }}
                p={1}
                display="flex"
                alignItems="center"
              >
                <ArrowLeft size={18} />
              </Box>
            )}
            <Text fontSize="16px" fontWeight={700} color="brand.brown" letterSpacing="-0.02em">
              {title}
            </Text>
          </Flex>
          {children}
        </Box>
      ) : faded ? (
        <Flex direction="column" align="center" justify="center" py={8} px={4}>
          <Box mb={2}>{icon}</Box>
          <Text fontSize="13px" fontWeight={600} color="brand.brown" textAlign="center" letterSpacing="-0.02em">
            {title}
          </Text>
        </Flex>
      ) : (
        <Flex
          direction="column"
          align="center"
          py={10}
          px={6}
          textAlign="center"
        >
          <Box mb={3}>{icon}</Box>
          <Text fontSize="17px" fontWeight={700} color="brand.brown" mb={2} letterSpacing="-0.02em">
            {title}
          </Text>
          <Text fontSize="13px" color="brand.textSecondary" mb={6} maxW="240px" lineHeight={1.5}>
            {description}
          </Text>
          <Flex align="center" gap={1} color="brand.orange" fontSize="14px" fontWeight={600}>
            {ctaLabel} <ArrowRight size={14} weight="bold" />
          </Flex>
        </Flex>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Update UploadPage.tsx icon props**

Replace emoji string props with Phosphor components:

```tsx
import { FolderOpen, GlobeHemisphereWest } from "@phosphor-icons/react";
```

Change the `icon` props on PathCard instances:
- File upload card (`📁` at line ~99): `icon={<FolderOpen size={36} />}`
- Story card (`📖` at line ~139): `icon={<GlobeHemisphereWest size={36} />}`

- [ ] **Step 5: Update HomepageHero.tsx headline tracking**

Add `letterSpacing="-0.02em"` to the main headline `Text` component in `HomepageHero.tsx`.

- [ ] **Step 6: Run tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PathCard.tsx src/pages/UploadPage.tsx src/components/__tests__/PathCard.test.tsx src/components/HomepageHero.tsx
git commit -m "feat: PathCard icon type, Phosphor icons, interaction states"
```

---

## Task 5: Icon sweep — progress, share, panels

**Files:**
- Modify: `frontend/src/components/ProgressTracker.tsx`
- Modify: `frontend/src/components/ShareButton.tsx`
- Modify: `frontend/src/components/SidePanel.tsx`
- Modify: `frontend/src/components/FileUploader.tsx`

- [ ] **Step 1: Update ProgressTracker.tsx**

Import Phosphor icons and replace:
- `✓` (line ~27) → `<Check size={14} weight="bold" />`
- `✕` (line ~51) → `<X size={14} weight="bold" />`
- Chakra `<Spinner>` → `<SpinnerGap size={16} style={{ animation: "spin 1s linear infinite" }} />`

- [ ] **Step 2: Update ShareButton.tsx**

Import and replace:
- `🔗` (line ~70) → `<LinkSimple size={14} weight="bold" />`
- `✓` (line ~71) → `<Check size={14} weight="bold" />`
- Update easing on line ~19 from `ease` to `cubic-bezier(0.32, 0.72, 0, 1)`

- [ ] **Step 3: Update SidePanel.tsx**

Import `Plus` from Phosphor. Replace the inline SVG (lines 63-66) with:

```tsx
<Plus size={14} weight="bold" />
```

Update transition on line 59 from `"all 200ms ease-out"` to use the shared `transition()` function from `interactionStyles.ts`.

- [ ] **Step 4: Update FileUploader.tsx**

Import `CloudArrowUp` from Phosphor. Replace `🗺` (line ~134) with:

```tsx
<CloudArrowUp size={40} />
```

Add drag interaction states:
- `_active` with `scale(0.99)` during drag
- Use `transition()` from `interactionStyles.ts`

- [ ] **Step 5: Verify build and tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressTracker.tsx src/components/ShareButton.tsx src/components/SidePanel.tsx src/components/FileUploader.tsx
git commit -m "feat: Phosphor icons for progress, share, panel, upload"
```

---

## Task 6: Icon sweep — cards and banners

**Files:**
- Modify: `frontend/src/components/ConversionSummaryCard.tsx`
- Modify: `frontend/src/components/StoryCTABanner.tsx`
- Modify: `frontend/src/components/ReportCard.tsx`
- Modify: `frontend/src/components/TechCard.tsx`

- [ ] **Step 1: Update ConversionSummaryCard.tsx**

- Replace `→` (line ~75) with `<ArrowRight size={12} weight="bold" />`
- Update transition (line ~33) to `transition(200)` from `interactionStyles.ts`
- Replace `_hover` (line ~34) with spread of `cardHover` style + existing `borderColor`
- Add `_active={cardActive}` and `_focusVisible={focusRing}`

Note: the `→` arrows at lines ~45 and ~55 are part of the pipeline visualization — leave those as text per the spec exception.

- [ ] **Step 2: Update StoryCTABanner.tsx**

- Replace `→` in "Create story →" (line ~69) with `<ArrowRight size={12} weight="bold" />`
- Update transition (line ~56) to `transition(200)`
- Replace `_hover` (line ~57) with `cardHover` style
- Add `_active={cardActive}` and `_focusVisible={focusRing}`

- [ ] **Step 3: Update ReportCard.tsx**

- Replace `✕` close button (line ~110) with `<X size={14} />`
- Leave `→` pipeline arrows (lines ~123, ~131) as text

- [ ] **Step 4: Update TechCard.tsx**

- Replace `↗` in "View repo ↗" with `<ArrowSquareOut size={12} />`
- Add `_hover={cardHover}`, `_active={cardActive}`, `_focusVisible={focusRing}`
- Add `transition={transition(200)}`

- [ ] **Step 5: Verify build and tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConversionSummaryCard.tsx src/components/StoryCTABanner.tsx src/components/ReportCard.tsx src/components/TechCard.tsx
git commit -m "feat: Phosphor icons and interaction states for cards"
```

---

## Task 7: Icon sweep — editors and readers

**Files:**
- Modify: `frontend/src/components/NarrativeEditor.tsx`
- Modify: `frontend/src/components/ChapterList.tsx`
- Modify: `frontend/src/components/VectorPopup.tsx`
- Modify: `frontend/src/components/InlineUpload.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx`
- Modify: `frontend/src/pages/StoryReaderPage.tsx`

- [ ] **Step 1: Update NarrativeEditor.tsx**

- Replace `✨` (line ~210) with `<Sparkle size={14} />` from Phosphor
- Replace `+` (line ~131) with `<Plus size={12} weight="bold" />`

- [ ] **Step 2: Update ChapterList.tsx**

- Replace `×` delete (line ~128) with `<X size={12} weight="bold" />`
- Replace `+` add (line ~152) with `<Plus size={12} weight="bold" />`

- [ ] **Step 3: Update VectorPopup.tsx**

- Replace `✕` (line ~67) with `<X size={14} />`

- [ ] **Step 4: Update InlineUpload.tsx**

- Replace `←` (line ~69) with `<ArrowLeft size={14} />`

- [ ] **Step 5: Update StoryEditorPage.tsx**

- Replace `📍` and `✓` (line ~470) with `<MapPin size={14} />` and `<Check size={14} />`
- Replace `"background 0.3s"` transition (line ~467) with `transition(300)` from `interactionStyles.ts` (this changes from animating `background` to animating `transform`/`opacity` — the visual effect changes, so verify it still looks intentional)

- [ ] **Step 6: Update StoryReaderPage.tsx**

- Replace `←` (line ~342) with `<ArrowLeft size={14} />`
- Update `"opacity 0.4s ease"` (line ~183) easing to `"opacity 400ms cubic-bezier(0.32, 0.72, 0, 1)"`

- [ ] **Step 7: Verify build and tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/NarrativeEditor.tsx src/components/ChapterList.tsx src/components/VectorPopup.tsx src/components/InlineUpload.tsx src/pages/StoryEditorPage.tsx src/pages/StoryReaderPage.tsx
git commit -m "feat: Phosphor icons for editors, readers, and popups"
```

---

## Task 8: Transition sweep — remaining files

**Files:**
- Modify: `frontend/src/components/TemporalControls.tsx`
- Modify: `frontend/src/components/FilterControls.tsx`

- [ ] **Step 1: Update TemporalControls.tsx**

- Line ~53: `"width 0.3s"` on the progress bar — this animates `width` which is a layout property. Accept as an exception: progress bars commonly animate width, it's a tiny element, and replacing with `scaleX()` would require restructuring the bar. Update the easing curve only: `"width 0.3s cubic-bezier(0.32, 0.72, 0, 1)"`.

- [ ] **Step 2: Update FilterControls.tsx**

- Replace `×` (lines ~44, ~103) with `<X size={10} weight="bold" />`
- Replace `+` (line ~163) with `<Plus size={12} weight="bold" />`

- [ ] **Step 3: Verify build and tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/TemporalControls.tsx src/components/FilterControls.tsx
git commit -m "feat: transition cleanup and remaining icon swaps"
```

---

## Task 9: Spinner replacement

**Files:**
- Modify: `frontend/src/components/ExploreTab.tsx` (line ~66)
- Modify: `frontend/src/pages/DatasetsPage.tsx`
- Modify: `frontend/src/pages/MapPage.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx`
- Modify: `frontend/src/pages/StoryReaderPage.tsx`
- Possibly others — verify with grep

Note: `ProgressTracker.tsx` Spinner was already replaced in Task 5.

- [ ] **Step 1: Grep for remaining Spinner usage**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && grep -rn "Spinner" src/ --include="*.tsx" | grep -v "SpinnerGap" | grep -v node_modules
```

- [ ] **Step 2: Replace each Chakra Spinner with Phosphor SpinnerGap**

For each file found:

```tsx
import { SpinnerGap } from "@phosphor-icons/react";

// Replace: <Spinner size="sm" color="brand.orange" />
// With:    <SpinnerGap size={16} color="#CF3F02" style={{ animation: "spin 1s linear infinite" }} />
```

Match the `size` and `color` props to what the existing Spinner used. Use `size={16}` for `"sm"`, `size={24}` for `"md"`, `size={32}` for `"lg"`.

- [ ] **Step 3: Verify build and tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add -u src/
git commit -m "feat: replace Chakra Spinners with Phosphor SpinnerGap"
```

---

## Task 10: Modal shadow updates

**Files:**
- Modify: `frontend/src/components/BugReportModal.tsx`
- Modify: `frontend/src/components/UploadModal.tsx`

- [ ] **Step 1: Update BugReportModal.tsx**

Find the shadow prop on the modal container and ensure it uses `shadow="lg"` (the new diffused `0 8px 40px rgba(0,0,0,0.08)` token from theme.ts). If it already says `shadow="lg"`, no change needed — it will pick up the new token automatically.

- [ ] **Step 2: Update UploadModal.tsx**

Same as above — verify the Chakra Dialog uses the `lg` shadow token. If the Dialog system uses its own shadow, override it with `shadow="lg"`.

- [ ] **Step 3: Verify build**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit** (only if changes were needed)

```bash
git add src/components/BugReportModal.tsx src/components/UploadModal.tsx
git commit -m "feat: apply soft shadow tokens to modals"
```

---

## Task 11: Body text max-width

Per the spec, body text should be constrained to ~65 characters for readability. This applies to longer prose blocks, not short labels or card descriptions.

**Files:**
- Modify: `frontend/src/components/HomepageHero.tsx` (subtitle text)
- Modify: `frontend/src/pages/StoryReaderPage.tsx` (story narrative blocks)
- Others as identified during visual verification

- [ ] **Step 1: Add maxW="65ch" to prose-length text blocks**

Only apply to text that is long enough to benefit (multi-sentence descriptions, story content). Skip short labels, card descriptions, and metadata text.

- [ ] **Step 2: Verify build**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -u src/
git commit -m "feat: constrain body text width for readability"
```

---

## Task 12: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /home/anthony/projects/cng-sandbox && docker compose -f docker-compose.yml up -d --build frontend
```

Or if running frontend locally:

```bash
cd /home/anthony/projects/cng-sandbox/frontend && yarn dev
```

- [ ] **Step 2: Take screenshots of key views**

Use Playwright MCP to navigate to `http://localhost:5185` and screenshot:
1. Homepage (upload page) — verify Satoshi font, Phosphor icons on PathCards
2. Hover over a PathCard — verify soft shadow and translateY lift
3. Click a PathCard — verify active press state
4. Upload a file — verify CloudArrowUp icon, progress tracker icons
5. Dataset map view — verify side panel icons, card hover states

Save screenshots to `/tmp/` for review.

- [ ] **Step 3: Check for visual regressions**

Look for:
- Font rendering issues (fallback to sans-serif means woff2 didn't load)
- Icons that are misaligned or wrong size
- Transitions that feel jarring or broken
- Shadows that are too strong or invisible
- Any remaining emoji that were missed

- [ ] **Step 4: Fix any issues found, re-verify, commit**

```bash
git add -u src/
git commit -m "fix: visual polish adjustments from verification"
```

---

## Task 13: Final build check

- [ ] **Step 1: Full build**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && yarn build
```

Expected: clean build, no errors.

- [ ] **Step 2: Run all tests**

```bash
cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit any final fixes**

If build or tests revealed issues, fix and commit.
