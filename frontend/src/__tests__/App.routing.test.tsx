import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import App from "../App";

vi.mock("../pages/MapPage", () => ({
  default: ({ shared }: { shared?: boolean }) => (
    <div data-testid="map-page" data-shared={shared ?? false} />
  ),
}));

vi.mock("../pages/StoryReaderPage", () => ({
  default: ({ embed }: { embed?: boolean }) => (
    <div data-testid="story-reader" data-embed={embed ?? false} />
  ),
}));

vi.mock("../pages/StoryEditorPage", () => ({
  default: () => <div data-testid="story-editor" />,
}));

vi.mock("../pages/StoryEmbedPage", () => ({
  default: () => <div data-testid="story-embed" />,
}));

vi.mock("../pages/UploadPage", () => ({
  default: () => <div data-testid="upload-page" />,
}));

vi.mock("../pages/StoriesPage", () => ({
  default: () => <div data-testid="stories-page" />,
}));

vi.mock("../pages/WorkspaceHomePage", () => ({
  default: () => <div data-testid="workspace-home-page" />,
}));

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

vi.mock("../pages/ExpiredPage", () => ({
  default: () => <div data-testid="expired-page" />,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderApp(route: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[route]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </ChakraProvider>
  );
}

test("/map/:id renders MapPage with shared=true", async () => {
  renderApp("/map/test-dataset-id");
  const el = await screen.findByTestId("map-page");
  expect(el).toHaveAttribute("data-shared", "true");
});

test("/map/connection/:id renders MapPage with shared=true", async () => {
  renderApp("/map/connection/test-conn-id");
  const el = await screen.findByTestId("map-page");
  expect(el).toHaveAttribute("data-shared", "true");
});

test("/story/:id renders StoryReaderPage", async () => {
  renderApp("/story/test-story-id");
  expect(await screen.findByTestId("story-reader")).toBeInTheDocument();
});

vi.mock("../pages/LandingPage", () => ({
  default: () => <div data-testid="landing-page" />,
}));

vi.mock("../pages/AboutPage", () => ({
  default: () => <div data-testid="about-page" />,
}));

vi.mock("../hooks/useWorkspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useWorkspace")>();
  return {
    ...actual,
    WorkspaceRedirect: () => <div data-testid="workspace-redirect" />,
  };
});

test("/ renders LandingPage (no auto-redirect to a workspace)", async () => {
  renderApp("/");
  expect(await screen.findByTestId("landing-page")).toBeInTheDocument();
});

test("/about renders the public AboutPage without a workspace", async () => {
  renderApp("/about");
  expect(await screen.findByTestId("about-page")).toBeInTheDocument();
});

test("/w/:workspaceId/ renders the WorkspaceHomePage", async () => {
  renderApp("/w/abc12345/");
  expect(await screen.findByTestId("workspace-home-page")).toBeInTheDocument();
});

test("/w/:workspaceId/quick-map renders the workspace UploadPage", async () => {
  renderApp("/w/abc12345/quick-map");
  expect(await screen.findByTestId("upload-page")).toBeInTheDocument();
});

test("/w/:workspaceId/stories renders the StoriesPage", async () => {
  renderApp("/w/abc12345/stories");
  expect(await screen.findByTestId("stories-page")).toBeInTheDocument();
});

test("unknown public path falls through to WorkspaceRedirect", () => {
  renderApp("/data");
  expect(screen.getByTestId("workspace-redirect")).toBeInTheDocument();
});

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

it.each([
  ["/w/workspace-1/library", "/w/workspace-1/data", "data-page"],
  ["/w/workspace-1/datasets", "/w/workspace-1/data", "data-page"],
  ["/w/workspace-1/story/story-1", "/story/story-1", "story-reader"],
])("preserves redirect from %s", async (from, to, testId) => {
  renderApp(from);
  expect(await screen.findByTestId(testId)).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent(to);
});
