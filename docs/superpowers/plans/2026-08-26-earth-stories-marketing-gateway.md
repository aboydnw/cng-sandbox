# Earth Stories Marketing Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public CNG homepage with an Earth Stories marketing gateway and add restrained Earth Stories repository links without changing any existing application route.

**Architecture:** Keep the existing React Router topology and page components intact. Rewrite only `LandingPage` presentation and its explicit sandbox-entry handler, then expose the same Earth Stories URL through shared `Header` and `Footer` chrome. Protect the boundary with focused component tests plus an expanded route-regression suite.

**Tech Stack:** React 19, TypeScript, React Router, Chakra UI v3, Phosphor Icons, Vitest, Testing Library

## Global Constraints

- Route preservation is release-blocking: do not add, remove, rename, reorder, or change the destination of any route in `frontend/src/App.tsx`.
- `/` must always render `LandingPage`, including when `WORKSPACE_STORAGE_KEY` contains a saved workspace ID.
- Do not add a `/sandbox` route; “Open the data sandbox” must navigate to the existing `/w/:workspaceId/` workspace root.
- Preserve the `/library` → `/data`, `/datasets` → `/data`, and workspace `/story/:id` → public `/story/:id` compatibility redirects.
- Earth Stories links must target exactly `https://github.com/aboydnw/earth-stories` in a new tab with `rel="noopener noreferrer"`.
- Preserve CNG-specific repository, issue-reporting, releases, support, backend, deployment, map, data, story, reader, editor, and embed behavior.
- Do not advertise a signed desktop download.
- Use existing warm brand tokens and Phosphor icons; add no dependency or styling framework.
- Do not change the Earth Stories repository for this release.

---

## File Map

- Modify `frontend/src/__tests__/App.routing.test.tsx`: enumerate representative public, workspace, compatibility-redirect, and fallback routes as a regression contract.
- Modify `frontend/src/pages/LandingPage.tsx`: render the marketing gateway, remove automatic redirect/example-story behavior, and implement explicit workspace entry.
- Modify `frontend/src/pages/__tests__/LandingPage.test.tsx`: specify homepage positioning, link safety, stored/new workspace flows, seeding fallback, and manual workspace entry.
- Modify `frontend/src/components/Header.tsx`: add a restrained workspace-only Earth Stories external link without changing internal navigation.
- Modify `frontend/src/components/__tests__/Header.test.tsx`: specify the workspace/public visibility and external-link contract.
- Modify `frontend/src/components/Footer.tsx`: distinguish Earth Stories and CNG repository links.
- Modify `frontend/src/components/__tests__/Footer.test.tsx`: specify both repository targets and safe external-link attributes.

### Task 1: Lock the Existing Route Contract

**Files:**
- Modify: `frontend/src/__tests__/App.routing.test.tsx`
- Verify unchanged: `frontend/src/App.tsx:14-101`

**Interfaces:**
- Consumes: the current `App` route table and `WorkspaceProvider` behavior.
- Produces: a route-regression suite that fails if any public route, workspace route, compatibility redirect, or fallback changes destination.

- [ ] **Step 1: Add page mocks for every route destination not already isolated**

Add explicit mocks with unique test IDs:

```tsx
vi.mock("../pages/DataPage", () => ({
  default: () => <div data-testid="data-page" />,
}));
vi.mock("../pages/DiscoverPage", () => ({
  default: () => <div data-testid="discover-page" />,
}));
vi.mock("../pages/DiscoverDatasetPage", () => ({
  default: () => <div data-testid="discover-dataset-page" />,
}));
vi.mock("../pages/StorySetupPage", () => ({
  default: () => <div data-testid="story-setup-page" />,
}));
```

Delete the obsolete `LibraryPage` mock because `App.tsx` does not import that component.

- [ ] **Step 2: Add a table-driven route inventory test**

Cover every direct destination with representative URLs:

```tsx
it.each([
  ["/", "landing-page"],
  ["/about", "about-page"],
  ["/story/story-1/embed", "story-embed"],
  ["/map/connection/connection-1", "map-page"],
  ["/map/dataset-1", "map-page"],
  ["/story/story-1", "story-reader"],
  ["/w/workspace-1/", "workspace-home-page"],
  ["/w/workspace-1/stories", "stories-page"],
  ["/w/workspace-1/quick-map", "upload-page"],
  ["/w/workspace-1/map/dataset-1", "map-page"],
  ["/w/workspace-1/map/connection/connection-1", "map-page"],
  ["/w/workspace-1/expired/dataset-1", "expired-page"],
  ["/w/workspace-1/data", "data-page"],
  ["/w/workspace-1/story/new", "story-setup-page"],
  ["/w/workspace-1/story/story-1/edit", "story-editor"],
  ["/w/workspace-1/about", "about-page"],
  ["/w/workspace-1/discover", "discover-page"],
  ["/w/workspace-1/discover/org/name", "discover-dataset-page"],
])("preserves %s", async (route, testId) => {
  renderApp(route);
  expect(await screen.findByTestId(testId)).toBeInTheDocument();
});
```

Keep the existing assertions that public maps receive `shared=true`.

- [ ] **Step 3: Add compatibility redirect assertions**

Use a location probe so redirects are verified by final pathname rather than only by rendered page:

```tsx
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
```

Render the probe beside `<App />`, then assert:

```tsx
it.each([
  ["/w/workspace-1/library", "/w/workspace-1/data", "data-page"],
  ["/w/workspace-1/datasets", "/w/workspace-1/data", "data-page"],
  ["/w/workspace-1/story/story-1", "/story/story-1", "story-reader"],
])("preserves redirect from %s", async (from, to, testId) => {
  renderApp(from);
  expect(await screen.findByTestId(testId)).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent(to);
});
```

Retain the unknown-public-path assertion for `WorkspaceRedirect`.

- [ ] **Step 4: Run the route contract test**

Run:

```bash
cd frontend
npx vitest run src/__tests__/App.routing.test.tsx
```

Expected: PASS. No edit to `App.tsx` is permitted to make this pass.

- [ ] **Step 5: Commit the route contract**

```bash
git add frontend/src/__tests__/App.routing.test.tsx
git commit -m "test: lock existing frontend routes"
```

### Task 2: Replace the Homepage With the Marketing Gateway

**Files:**
- Modify: `frontend/src/pages/__tests__/LandingPage.test.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `WORKSPACE_STORAGE_KEY`, `generateWorkspaceId()`, `setWorkspaceId(id: string)`, `seedExampleData(id: string)`, `useNavigate()`.
- Produces: `LandingPage` whose Earth Stories URL is constant, whose homepage never redirects on mount, and whose sandbox CTA always resolves to `/w/:workspaceId/`.

- [ ] **Step 1: Replace obsolete homepage tests with the new external-link and positioning contract**

Remove tests for example-story loading/cloning, “Start a story,” CNG as the main GitHub destination, and automatic stored-workspace redirect. Add:

```tsx
it("presents Earth Stories and the two product paths", () => {
  renderLanding();
  expect(
    screen.getByRole("heading", { name: /earth stories/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /explore earth stories/i })
  ).toHaveAttribute("href", "https://github.com/aboydnw/earth-stories");
  expect(
    screen.getByRole("button", { name: /open the data sandbox/i })
  ).toBeInTheDocument();
});

it("opens Earth Stories safely in a new tab", () => {
  renderLanding();
  const link = screen.getByRole("link", { name: /explore earth stories/i });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
});
```

- [ ] **Step 2: Write failing tests for explicit stored-workspace entry**

```tsx
it("always shows the homepage when a workspace is stored", () => {
  localStorage.setItem("myWorkspaceId", "stored123");
  renderLanding();
  expect(screen.getByRole("heading", { name: /earth stories/i })).toBeInTheDocument();
  expect(screen.queryByTestId("workspace-target")).not.toBeInTheDocument();
});

it("opens the stored workspace only after the sandbox CTA is selected", async () => {
  localStorage.setItem("myWorkspaceId", "stored123");
  renderLanding();
  fireEvent.click(screen.getByRole("button", { name: /open the data sandbox/i }));
  expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
    "data-workspace-id",
    "stored123"
  );
  expect(screen.getByTestId("workspace-target")).toHaveAttribute("data-rest", "/");
});
```

- [ ] **Step 3: Write failing tests for new-workspace entry and seeding fallback**

Mock `generateWorkspaceId` to return `generated123`, then assert both success and rejection paths:

```tsx
it("creates and seeds a workspace before opening the sandbox root", async () => {
  renderLanding();
  fireEvent.click(screen.getByRole("button", { name: /open the data sandbox/i }));
  expect(seedExampleData).toHaveBeenCalledWith("generated123");
  expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
    "data-rest",
    "/"
  );
});

it("opens the sandbox root when example seeding fails", async () => {
  vi.mocked(seedExampleData).mockRejectedValueOnce(new Error("HTTP 500"));
  renderLanding();
  fireEvent.click(screen.getByRole("button", { name: /open the data sandbox/i }));
  expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
    "data-rest",
    "/"
  );
});
```

Keep the existing manual workspace-ID, trimming, and empty-input tests.

- [ ] **Step 4: Run the focused homepage test to confirm the new contract fails**

Run:

```bash
cd frontend
npx vitest run src/pages/__tests__/LandingPage.test.tsx
```

Expected: FAIL because the current page redirects automatically, points at CNG GitHub, and navigates new users to `/story/new`.

- [ ] **Step 5: Remove automatic redirect and example-story behavior from `LandingPage`**

Remove `useEffect`, `useSearchParams`, `useCallback`, `useRef`, example story API/type imports, `ExampleStoryCard`, `StatePanel`, skeletons, example state, `loadExamples`, `startStory`, and `openExampleStory`.

Keep only local state for `enteredId` and a loading guard for sandbox creation. Define:

```tsx
const EARTH_STORIES_URL = "https://github.com/aboydnw/earth-stories";

const openSandbox = async () => {
  const storedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (storedId) {
    navigate(`/w/${storedId}/`);
    return;
  }

  setOpeningSandbox(true);
  const id = generateWorkspaceId();
  localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
  setWorkspaceId(id);
  try {
    await seedExampleData(id);
  } catch {
    // Seeding is best-effort; the workspace still opens.
  }
  navigate(`/w/${id}/`);
};
```

Disable the sandbox button while `openingSandbox` is true to prevent duplicate workspace creation.

- [ ] **Step 6: Implement the concise marketing layout**

Retain `<Header showWorkspace={false} />`, `<main id="main-content">`, the manual workspace form, and `<Footer />`. Replace the central content with:

```tsx
<Text textStyle="eyebrow">Open-source science storytelling</Text>
<Heading textStyle="display">Earth Stories</Heading>
<Text fontSize="lg" color="fg.muted" maxW="58ch">
  Turn geospatial data into clear, publishable stories that combine maps,
  narrative, images, charts, and video.
</Text>
<Flex gap={4} wrap="wrap">
  <Button asChild size="lg">
    <a href={EARTH_STORIES_URL} target="_blank" rel="noopener noreferrer">
      Explore Earth Stories <ArrowSquareOut aria-hidden="true" />
    </a>
  </Button>
  <Button
    size="lg"
    variant="outline"
    onClick={openSandbox}
    loading={openingSandbox}
    disabled={openingSandbox}
  >
    Open the data sandbox <ArrowRight aria-hidden="true" />
  </Button>
</Flex>
```

Add three compact supporting sections using existing `Box`, `Flex`, `Heading`, and `Text` primitives:

- “Build a story” — explain the Earth Stories narrative workflow.
- “Publish and share” — explain portable, interactive output without claiming a signed installer.
- “Explore data in the browser” — explain that CNG Sandbox uploads/connects geospatial sources for immediate map exploration.

Do not add screenshots, remote assets, animation, example API requests, or new components.

- [ ] **Step 7: Run and refine the focused homepage test**

Run:

```bash
cd frontend
npx vitest run src/pages/__tests__/LandingPage.test.tsx
```

Expected: PASS with no unhandled promise warnings.

- [ ] **Step 8: Commit the homepage gateway**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx
git commit -m "feat: present Earth Stories from the homepage"
```

### Task 3: Add Restrained Earth Stories Links to Shared Chrome

**Files:**
- Modify: `frontend/src/components/__tests__/Header.test.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/__tests__/Footer.test.tsx`
- Modify: `frontend/src/components/Footer.tsx`

**Interfaces:**
- Consumes: `useOptionalWorkspace()` to distinguish workspace and public header contexts.
- Produces: safe external links to the Earth Stories repository while retaining the CNG repository link.

- [ ] **Step 1: Replace the obsolete header GitHub exclusion test**

Specify one workspace-only tertiary link:

```tsx
it("links workspace users to Earth Stories", () => {
  renderWithProviders(<Header />);
  const link = screen.getByRole("link", { name: /earth stories on github/i });
  expect(link).toHaveAttribute("href", "https://github.com/aboydnw/earth-stories");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
});

it("keeps the public marketing header focused", () => {
  renderPublic();
  expect(
    screen.queryByRole("link", { name: /earth stories on github/i })
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing footer tests for distinct repositories**

```tsx
it("links to Earth Stories and CNG Sandbox as distinct repositories", () => {
  renderFooter();
  expect(screen.getByRole("link", { name: /earth stories on github/i })).toHaveAttribute(
    "href",
    "https://github.com/aboydnw/earth-stories"
  );
  expect(screen.getByRole("link", { name: /cng sandbox on github/i })).toHaveAttribute(
    "href",
    "https://github.com/aboydnw/cng-sandbox"
  );
});
```

Assert `target="_blank"` and both `noopener` and `noreferrer` for each external repository link.

- [ ] **Step 3: Run the focused shared-chrome tests to confirm failure**

Run:

```bash
cd frontend
npx vitest run src/components/__tests__/Header.test.tsx src/components/__tests__/Footer.test.tsx
```

Expected: FAIL because Earth Stories links do not exist and the footer’s current “GitHub repository” label is ambiguous.

- [ ] **Step 4: Add the workspace-only header link**

Define the URL once in `Header.tsx`, import `ArrowSquareOut`, and render the link only when `workspace` exists:

```tsx
const EARTH_STORIES_URL = "https://github.com/aboydnw/earth-stories";

{workspace && (
  <Box asChild color="fg.muted" fontSize="sm" fontWeight={500}>
    <a
      href={EARTH_STORIES_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Earth Stories on GitHub (opens in a new tab)"
    >
      <Flex align="center" gap={1}>
        Earth Stories <ArrowSquareOut size={14} aria-hidden="true" />
      </Flex>
    </a>
  </Box>
)}
```

Place it in the right-side utility area before the workspace menu. Do not alter the internal Stories, Data, or About `NavLink` elements.

- [ ] **Step 5: Make footer repository links explicit**

Use separate constants and labels:

```tsx
const EARTH_STORIES_URL = "https://github.com/aboydnw/earth-stories";
const CNG_GITHUB_URL = "https://github.com/aboydnw/cng-sandbox";
```

Render “Earth Stories” and “CNG Sandbox” as separate links with accessible labels “Earth Stories on GitHub” and “CNG Sandbox on GitHub.” Keep About, Contact Us, and Development Seed credit unchanged.

- [ ] **Step 6: Run the focused shared-chrome tests**

Run:

```bash
cd frontend
npx vitest run src/components/__tests__/Header.test.tsx src/components/__tests__/Footer.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit shared CTAs**

```bash
git add frontend/src/components/Header.tsx frontend/src/components/__tests__/Header.test.tsx frontend/src/components/Footer.tsx frontend/src/components/__tests__/Footer.test.tsx
git commit -m "feat: link shared pages to Earth Stories"
```

### Task 4: Verify the Minimal Change Set

**Files:**
- Verify: `frontend/src/App.tsx`
- Verify: all files modified in Tasks 1-3

**Interfaces:**
- Consumes: the completed route contract, homepage gateway, and shared chrome links.
- Produces: evidence that the complete frontend remains healthy and the diff stays within approved scope.

- [ ] **Step 1: Run formatting validation**

Run:

```bash
cd frontend
npx prettier --check src/App.tsx src/__tests__/App.routing.test.tsx src/pages/LandingPage.tsx src/pages/__tests__/LandingPage.test.tsx src/components/Header.tsx src/components/__tests__/Header.test.tsx src/components/Footer.tsx src/components/__tests__/Footer.test.tsx
```

Expected: all matched files use Prettier formatting. If not, run the repository’s approved Prettier write command on exactly those files, then rerun the check.

- [ ] **Step 2: Run focused acceptance tests**

Run:

```bash
cd frontend
npx vitest run src/__tests__/App.routing.test.tsx src/pages/__tests__/LandingPage.test.tsx src/components/__tests__/Header.test.tsx src/components/__tests__/Footer.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the complete frontend suite**

Run:

```bash
cd frontend
npx vitest run
```

Expected: PASS with zero failed tests.

- [ ] **Step 4: Audit route preservation and diff scope**

Run:

```bash
git diff main...HEAD -- frontend/src/App.tsx
git diff --check main...HEAD
git status --short
```

Expected:

- the `App.tsx` diff is empty;
- `git diff --check` reports no whitespace errors;
- only the approved spec, plan, frontend components, and tests are changed;
- no backend, deployment, routing, or Earth Stories file appears.

- [ ] **Step 5: Perform a lightweight responsive review**

Run the frontend from this worktree only:

```bash
cd frontend
npx vite dev --port 5285
```

At `/`, verify at narrow mobile and desktop widths that the headline, both CTAs, supporting sections, workspace-ID form, header, and footer remain readable without horizontal overflow. Visit an existing `/w/:workspaceId/` page and confirm the Earth Stories link does not crowd out the workspace menu. Stop the dev server after review.

- [ ] **Step 6: Commit any verification-only corrections**

If formatting or responsive review required changes, stage only the files changed for those corrections and commit:

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx frontend/src/components/Header.tsx frontend/src/components/__tests__/Header.test.tsx frontend/src/components/Footer.tsx frontend/src/components/__tests__/Footer.test.tsx frontend/src/__tests__/App.routing.test.tsx
git commit -m "fix: polish Earth Stories marketing gateway"
```

If no corrections were required, do not create an empty commit.

