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

vi.mock("../pages/LibraryPage", () => ({
  default: () => <div data-testid="library-page" />,
}));

vi.mock("../pages/ExpiredPage", () => ({
  default: () => <div data-testid="expired-page" />,
}));

vi.mock("../components/WelcomeToast", () => ({
  WelcomeToast: () => null,
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

test("/map/:id renders MapPage with shared=true", () => {
  renderApp("/map/test-dataset-id");
  const el = screen.getByTestId("map-page");
  expect(el).toHaveAttribute("data-shared", "true");
});

test("/map/connection/:id renders MapPage with shared=true", () => {
  renderApp("/map/connection/test-conn-id");
  const el = screen.getByTestId("map-page");
  expect(el).toHaveAttribute("data-shared", "true");
});

test("/story/:id renders StoryReaderPage", () => {
  renderApp("/story/test-story-id");
  expect(screen.getByTestId("story-reader")).toBeInTheDocument();
});
