# Visual QA checklist

Every design-polish PR should include targeted before/after evidence. The goal
is not to capture every route every time, but to prevent polished happy paths
from hiding broken intermediate states or narrow layouts.

## Standard capture setup

- Use the isolated worktree frontend at `http://localhost:5285` for
  frontend-only work.
- Use the isolated worktree Docker stack when the change requires local backend
  state. Never start, stop, or rebuild the production stack.
- Use stable fixture/example data when possible so screenshots are comparable.
- Hide browser chrome unless it is relevant to the issue.
- Capture the complete viewport, plus a close crop when control detail matters.
- Name evidence consistently: `<surface>-<state>-<width>.png`.

## Required viewport matrix

| Width | Purpose |
|---:|---|
| 1440px | Wide desktop composition and maximum content width |
| 1024px | Narrow desktop, panel competition, navigation pressure |
| 768px | Tablet reflow and touch-oriented controls |
| 390px | Mobile navigation, stacking, drawers, and overflow |

Not every PR needs all four screenshots. Any structural page, navigation, map
panel, table, editor, or dialog change must test all four widths. A small token
or isolated component change may test its affected widths only.

## State matrix

For every affected surface, check all applicable states:

- Default populated state.
- Hover and pressed state for primary interactions.
- Keyboard focus state.
- Loading state.
- Empty state.
- Recoverable error state.
- Disabled state.
- Long title or filename.
- Dense/high-count content.
- Success or saved state.
- Reduced-motion behavior when animation changes.

## Core screenshot set

### Global navigation

- Landing page with no workspace context.
- Workspace home with active navigation.
- Data and Stories active states.
- Workspace menu open.
- Header at 768px and 390px.
- Keyboard focus moving through logo, navigation, primary action, and workspace
  menu.

### Landing page

- Examples loading.
- Featured and secondary examples populated.
- Example clone in progress.
- Long featured-story title.
- Existing workspace form empty, focused, and populated.
- 1440px, 768px, and 390px compositions.

### Workspace home

- Brand-new empty workspace with examples available.
- Workspace with recent story and recent data.
- Only stories and only data.
- Loading skeleton.
- Fetch failure without losing the page shell.
- Long item title and old timestamp.

### Data library

- Populated with mixed raster, vector, temporal, point-cloud, and connection
  types when fixtures permit.
- Examples shown and hidden.
- Empty library.
- Loading skeleton.
- Fetch failure with retry.
- Expiring item, conversion in progress, and failed item.
- Destructive action exposed and confirmation state.
- Narrow layout with long filenames.

### Stories

- User stories and examples visibly separated.
- Empty user-story collection with a primary creation action.
- Loading and fetch failure.
- Story with snapshot and intentional fallback preview.
- Draft/shared/published distinctions if surfaced.
- Long title and high chapter count.

### Upload and conversion

- Initial path selection.
- File-drop idle, drag-over, keyboard focus, selected file, unsupported file,
  and disabled state.
- URL entry idle, detecting, recognized, unsupported, and failed.
- Column/variable selection with validation.
- Uploading, scanning, paused-for-input, converting, storing, ready, warning,
  and failed stages where fixtures permit.
- 390px layout with the software keyboard assumption considered.

### Map workspace

Capture at least one example of each affected data path:

- Raster/COG.
- Vector/GeoParquet.
- Temporal raster.
- Zarr when changed.
- COPC point cloud when changed.
- GPX trajectory when changed.

For each relevant path, check:

- Initial loading and loaded map.
- Side panel open, collapsed, and narrow-screen drawer/sheet.
- Basemap menu with selection visible without relying only on color.
- Legend and feature/pixel inspection popup.
- Zoom prompt, render-mode indicator, snapshot, share, and chat control
  collisions.
- Map error and unsupported-browser state.
- Light, dark, and imagery basemap contrast for overlaid controls.
- Keyboard focus and screen-edge clipping.

### Story editor and reader

- New empty story.
- Mixed chapter types.
- Selected, unselected, incomplete, and warning chapter states.
- Saving, saved, and save failure.
- Publish readiness with advisory and blocking issues.
- Preview and reader output at desktop and mobile widths.
- Reduced-motion treatment for flyover or animated content.

## Review criteria

### Hierarchy

- Is there one obvious primary action?
- Can the page identity and current location be understood quickly?
- Does metadata remain subordinate to titles and tasks?
- Are examples distinct from user-owned work?

### Consistency

- Do equivalent actions use the same component and language?
- Are surface, border, radius, and shadow roles consistent?
- Are loading, empty, and error states structurally related to the final state?
- Do map controls feel like one family?

### Content

- Is wording outcome-oriented and specific?
- Are technical terms explained or progressively disclosed?
- Are retention, privacy, sharing, and conversion consequences stated at the
  moment they matter?
- Do truncation and wrapping preserve important identifiers?

### Accessibility

- Is every interaction keyboard reachable with a visible focus indicator?
- Is selection conveyed by more than color?
- Do icon-only controls have accessible names and tooltips?
- Is small or muted text readable against its surface?
- Are status updates announced without stealing focus?
- Are touch targets sufficiently large on narrow screens?

### Robustness

- Does content remain usable at 200% zoom?
- Is there unintended horizontal scrolling?
- Do long names, errors, URLs, and metadata break layout?
- Do dialogs and drawers stay within the viewport?
- Does reduced motion preserve meaning and task completion?

## PR evidence template

Include this compact record in design-polish PR descriptions:

```markdown
### Visual QA

- Surfaces changed:
- Viewports checked: 1440 / 1024 / 768 / 390
- States checked: populated / loading / empty / error / focus / disabled
- Data paths checked:
- Before:
- After:
- Intentional deviations from `docs/design-polish/`:
```
