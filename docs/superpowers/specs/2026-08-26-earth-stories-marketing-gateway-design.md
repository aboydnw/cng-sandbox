# Earth Stories Marketing Gateway Design

**Status:** Draft for review
**Date:** 2026-08-26
**Repository:** CNG Sandbox

## Purpose

Turn `storytelling.developmentseed.org` into a clear entry point for Earth Stories while preserving CNG Sandbox as the existing hosted geospatial data sandbox. The change is deliberately small: replace the public homepage, add restrained links to Earth Stories from existing application chrome, and leave the rest of the product untouched.

Earth Stories remains a separate application and repository:

`https://github.com/aboydnw/earth-stories`

This release does not move Earth Stories code into CNG Sandbox and does not claim that a signed desktop download is available.

## Firm Requirements

### Route preservation is release-blocking

No existing route may be renamed, removed, redirected to a different product, or assigned different application content as part of this work. Existing bookmarks, shared links, embeds, and workspace URLs must continue to resolve exactly as they do before the change.

The implementation must preserve all routes currently declared in `frontend/src/App.tsx`, including:

- `/about`
- `/story/:id/embed`
- `/map/connection/:id`
- `/map/:id`
- `/story/:id`
- `/w/:workspaceId/`
- `/w/:workspaceId/stories`
- `/w/:workspaceId/quick-map`
- `/w/:workspaceId/map/:id`
- `/w/:workspaceId/map/connection/:id`
- `/w/:workspaceId/expired/:id`
- `/w/:workspaceId/data`
- `/w/:workspaceId/library`
- `/w/:workspaceId/datasets`
- `/w/:workspaceId/story/new`
- `/w/:workspaceId/story/:id`
- `/w/:workspaceId/story/:id/edit`
- `/w/:workspaceId/about`
- `/w/:workspaceId/discover`
- `/w/:workspaceId/discover/:org/:name`
- the existing unmatched-path `WorkspaceRedirect` fallback

The existing redirects from workspace `/library` and `/datasets` to workspace `/data`, and from workspace `/story/:id` to public `/story/:id`, must retain their current behavior.

There will be no new `/sandbox` route. “Open the data sandbox” uses the existing workspace routes.

### The homepage always appears

`/` always renders the new marketing page. A stored workspace ID must not cause an automatic redirect away from `/`.

Returning users enter their stored workspace only after selecting the explicit “Open the data sandbox” action. Users without a stored workspace receive a newly generated workspace ID, the existing example-seeding request remains best-effort, and they enter the existing workspace root at `/w/:workspaceId/`.

The existing manual workspace-ID form remains available so collaborators can open a known `/w/:workspaceId/` workspace.

### Scope stays minimal

The implementation changes only frontend presentation and navigation initiated by the new CTAs. It must not change:

- backend APIs, database schemas, or ingestion behavior;
- CNG story creation, editing, reading, publishing, exporting, or embedding;
- map, data, connection, discovery, or workspace behavior;
- production routing, Caddy configuration, proxy paths, or deployment topology;
- Earth Stories source code, packaging, releases, or documentation;
- CNG repository, issue-reporting, release, or support links where those links specifically refer to CNG Sandbox.

## Product Positioning

The homepage presents two related but distinct paths:

1. **Earth Stories** is the primary storytelling product. It helps people turn geospatial data, narrative, maps, images, charts, and video into publishable science stories. Its current public access point is the GitHub repository.
2. **CNG Sandbox** is the hosted browser tool for uploading or connecting geospatial data and exploring it on a map.

The page must not describe CNG Sandbox as Earth Stories or imply that the two repositories have merged. It must not advertise a public desktop installer until signed, notarized, validated installers actually exist.

## Homepage Design

`frontend/src/pages/LandingPage.tsx` remains the component rendered at `/`, but its content and behavior change from the current CNG story-starting page to a compact marketing gateway.

### Hero

The hero leads with Earth Stories and Development Seed’s science-storytelling purpose. It includes:

- a clear Earth Stories headline;
- a short explanation of the local-first storytelling workflow;
- a primary external CTA labeled “Explore Earth Stories” pointing to `https://github.com/aboydnw/earth-stories`;
- a secondary CTA labeled “Open the data sandbox” that opens the stored workspace or creates a workspace at the existing workspace root;
- honest supporting copy that the GitHub repository contains the current source and setup instructions.

The Earth Stories link opens in a new tab with `rel="noopener noreferrer"`. The sandbox action stays in the current tab.

### Supporting content

Keep the page concise. Below the hero, include only enough content to answer:

- What can someone make with Earth Stories?
- How does the workflow move from data to a publishable story?
- What can someone do immediately in the browser sandbox?

Reuse the existing design system, warm brand tokens, responsive layout patterns, Phosphor icons, `Header`, and `Footer`. Do not introduce a new styling framework, illustration system, dependency, animation framework, or bespoke route shell.

### Removed homepage behavior

The homepage no longer:

- redirects automatically to the locally stored workspace;
- starts a CNG story as its primary action;
- loads or clones example CNG stories;
- describes the CNG repository as the destination of the main GitHub CTA.

Removing these behaviors from the homepage does not remove their underlying routes or capabilities. Story creation remains available inside existing workspaces.

## Earth Stories CTAs Outside the Homepage

Add restrained, external Earth Stories links through shared application chrome rather than redesigning individual product pages:

- Add an “Earth Stories” link with an external-link affordance to the workspace `Header`. It points to `https://github.com/aboydnw/earth-stories`, opens in a new tab, and appears as a tertiary navigation action after the existing internal navigation.
- Add an “Earth Stories” link to the shared `Footer` alongside the existing CNG GitHub and contact links. The existing CNG GitHub link remains and is relabeled if necessary so the two repositories are unambiguous.

These shared placements provide CTAs across workspace home, stories, data, about, discovery, and other standard pages without modifying each page independently. Embed-only and immersive map/story surfaces that intentionally omit shared chrome remain unchanged.

The CTA copy must distinguish the product from the repository destination. Suitable accessible labels include “Earth Stories on GitHub” or visible “Earth Stories” text with an accessible external-link description.

## Navigation and Data Flow

### Explore Earth Stories

1. The visitor selects “Explore Earth Stories.”
2. The browser opens `https://github.com/aboydnw/earth-stories` in a new tab.
3. CNG state and the current page remain unchanged.

### Open the data sandbox

1. Read `WORKSPACE_STORAGE_KEY` from local storage only after the visitor selects the CTA.
2. If a value exists, navigate to `/w/{storedWorkspaceId}/`.
3. If no value exists, generate an ID with `generateWorkspaceId()`, store it under `WORKSPACE_STORAGE_KEY`, call `setWorkspaceId(id)`, and make the existing `seedExampleData(id)` request.
4. Treat seeding as best-effort, matching current homepage behavior.
5. Navigate to `/w/{id}/` whether seeding succeeds or fails.

The CTA must not navigate to `/story/new`; entering the sandbox opens the workspace home.

### Open a known workspace

The manual workspace form trims the supplied ID and navigates to `/w/{id}/`. Empty input remains disabled and does not navigate.

## Accessibility and Responsive Behavior

- Preserve the skip link and `main-content` target.
- Keep a single clear page-level heading.
- External links have meaningful accessible names and visible focus states.
- CTA hierarchy remains understandable without color alone.
- The hero and supporting sections work at existing mobile and desktop breakpoints without horizontal overflow.
- Icon usage follows the existing Phosphor requirement; icons do not replace text labels.

## Testing Strategy

### Homepage tests

Update `frontend/src/pages/__tests__/LandingPage.test.tsx` to verify:

- `/` renders the Earth Stories headline and both primary CTAs;
- the Earth Stories CTA targets exactly `https://github.com/aboydnw/earth-stories` and uses safe external-link attributes;
- a stored workspace does not redirect on page load;
- selecting “Open the data sandbox” with a stored ID navigates to its workspace root;
- selecting it without a stored ID creates an ID, attempts example seeding, and navigates to the workspace root;
- a seeding failure still navigates to the workspace root;
- the CTA never navigates to `/story/new`;
- the manual workspace-ID form remains functional;
- no example-story fetch or clone behavior remains on the homepage.

### Shared CTA tests

Update the existing `Header` and `Footer` tests to verify the new Earth Stories link, its exact URL, its external-link behavior, and the continued presence of the CNG-specific GitHub link in the footer.

### Route-regression tests

Add or extend an `App` route test that enumerates the current public and workspace route patterns and asserts that representative URLs still render or redirect to the same page components. The test must explicitly cover shared map, story reader, embed, workspace home, workspace stories, workspace data, story setup, story editor, discovery, and the existing compatibility redirects.

The route-regression test is a release gate. A marketing implementation that changes any existing destination fails acceptance even if the new homepage tests pass.

### Verification

Run the focused landing, header, footer, and route tests first, followed by the full frontend suite:

```bash
cd frontend
npx vitest run src/pages/__tests__/LandingPage.test.tsx src/components/__tests__/Header.test.tsx src/components/__tests__/Footer.test.tsx
npx vitest run
```

No backend, archive-runtime, or full Docker-stack test is required because this scope changes no backend contract, proxy, tile path, or archival runtime behavior.

## Acceptance Criteria

- Visiting `/` always shows the Earth Stories marketing gateway, even when local storage contains a workspace ID.
- The primary CTA links to `https://github.com/aboydnw/earth-stories`.
- “Open the data sandbox” uses only existing `/w/:workspaceId/` behavior and never introduces or requires `/sandbox`.
- Shared application chrome contains restrained Earth Stories repository CTAs while preserving CNG-specific repository and support links.
- Every route and compatibility redirect listed under Firm Requirements behaves exactly as it did before this work.
- No Earth Stories repository change is required for this release.
- No signed-download promise appears on the page.
- The full frontend test suite passes.

## Explicit Non-Goals

- Removing, deprecating, redirecting, or renaming any CNG route.
- Removing CNG storytelling features.
- Building a new sandbox route or application shell.
- Migrating data or stories between CNG and Earth Stories.
- Adding an automated handoff from CNG to Earth Stories.
- Producing or distributing Earth Stories desktop installers.
- Changing the production domain or infrastructure.
- Redesigning workspace, data, map, story, discovery, reader, editor, or embed pages.
