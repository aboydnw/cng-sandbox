import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("../pages/LibraryPage", () => ({
  default: () => <div data-testid="library-page" />,
}));

vi.mock("../pages/ExpiredPage", () => ({
  default: () => <div data-testid="expired-page" />,
}));

function renderApp(route: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[route]}>
        <App />
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
