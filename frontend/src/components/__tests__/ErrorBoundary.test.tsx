import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ErrorBoundary } from "../ErrorBoundary";

function wrap(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function Boom({
  message = "kaboom",
}: {
  message?: string;
}): React.ReactElement {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when no error is thrown", () => {
    wrap(
      <ErrorBoundary>
        <div data-testid="child">OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders fallback with error message, refresh button, and GitHub issue link on crash", () => {
    wrap(
      <ErrorBoundary>
        <Boom message="this.props.onAfterRender is not a function" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this\.props\.onAfterRender is not a function/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh page/i })
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /report on github/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/aboydnw/cng-sandbox/issues/new"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
