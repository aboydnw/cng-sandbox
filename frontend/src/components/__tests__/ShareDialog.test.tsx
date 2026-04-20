import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { ShareDialog } from "../ShareDialog";
import { system } from "../../theme";

vi.mock("../../lib/api", () => ({
  connectionsApi: {
    share: vi.fn(),
  },
  datasetsApi: {
    share: vi.fn(),
  },
}));

import { connectionsApi, datasetsApi } from "../../lib/api";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

const defaultProps = {
  kind: "connection" as const,
  resourceId: "abc-123",
  isShared: false,
  isOpen: true,
  onClose: vi.fn(),
  onSharedChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShareDialog", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = renderWithChakra(
      <ShareDialog {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Share publicly heading when isShared is false", () => {
    renderWithChakra(<ShareDialog {...defaultProps} isShared={false} />);
    expect(screen.getByText("Share publicly")).toBeTruthy();
  });

  it("renders Public link heading when isShared is true", () => {
    renderWithChakra(<ShareDialog {...defaultProps} isShared={true} />);
    const heading = screen.getByRole("heading", { name: "Public link" });
    expect(heading).toBeTruthy();
  });

  it("shows shareable URL and copy button when isShared is true", () => {
    renderWithChakra(
      <ShareDialog
        {...defaultProps}
        kind="dataset"
        resourceId="xyz-456"
        isShared={true}
      />
    );
    const urlInput = screen.getByDisplayValue(
      `${window.location.origin}/map/xyz-456`
    );
    expect(urlInput).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy/i })).toBeTruthy();
  });

  it("uses /map/connection/:id for connection shareable URL", () => {
    renderWithChakra(
      <ShareDialog
        {...defaultProps}
        kind="connection"
        resourceId="abc-123"
        isShared={true}
      />
    );
    expect(
      screen.getByDisplayValue(
        `${window.location.origin}/map/connection/abc-123`
      )
    ).toBeTruthy();
  });

  it("clicking Copy writes share URL to clipboard and flips to Copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithChakra(
      <ShareDialog
        {...defaultProps}
        kind="dataset"
        resourceId="xyz-456"
        isShared={true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy/i }));

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/map/xyz-456`
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copied/i })).toBeTruthy();
    });
  });

  it("clicking Share calls connectionsApi.share(id, true) then onSharedChange(true) and keeps dialog open", async () => {
    vi.mocked(connectionsApi.share).mockResolvedValue(undefined);
    const onSharedChange = vi.fn();
    const onClose = vi.fn();

    renderWithChakra(
      <ShareDialog
        {...defaultProps}
        kind="connection"
        resourceId="abc-123"
        isShared={false}
        onSharedChange={onSharedChange}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Share$/i }));

    await waitFor(() => {
      expect(connectionsApi.share).toHaveBeenCalledWith("abc-123", true);
      expect(onSharedChange).toHaveBeenCalledWith(true);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking Stop sharing calls datasetsApi.share(id, false) then onSharedChange(false) then onClose", async () => {
    vi.mocked(datasetsApi.share).mockResolvedValue(undefined);
    const onSharedChange = vi.fn();
    const onClose = vi.fn();

    renderWithChakra(
      <ShareDialog
        {...defaultProps}
        kind="dataset"
        resourceId="xyz-456"
        isShared={true}
        onSharedChange={onSharedChange}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Stop sharing/i }));

    await waitFor(() => {
      expect(datasetsApi.share).toHaveBeenCalledWith("xyz-456", false);
      expect(onSharedChange).toHaveBeenCalledWith(false);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("clicking Done in shared view closes the dialog", () => {
    const onClose = vi.fn();
    renderWithChakra(
      <ShareDialog {...defaultProps} isShared={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Done$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error message when API rejects", async () => {
    vi.mocked(connectionsApi.share).mockRejectedValue(
      new Error("Server error")
    );

    renderWithChakra(
      <ShareDialog {...defaultProps} kind="connection" isShared={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Share$/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    });
  });
});
