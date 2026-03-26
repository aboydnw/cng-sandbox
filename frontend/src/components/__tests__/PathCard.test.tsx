import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { FolderOpen } from "@phosphor-icons/react";
import { PathCard } from "../PathCard";
import { system } from "../../theme";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("PathCard", () => {
  const defaultProps = {
    icon: <FolderOpen size={36} data-testid="folder-icon" />,
    title: "Convert a file",
    description: "Upload a geospatial file",
    ctaLabel: "Browse files",
    onClick: vi.fn(),
    expanded: false,
    faded: false,
  };

  it("renders title, description, and CTA in collapsed state", () => {
    renderWithChakra(<PathCard {...defaultProps} />);
    expect(screen.getByText("Convert a file")).toBeTruthy();
    expect(screen.getByText("Upload a geospatial file")).toBeTruthy();
    expect(screen.getByText("Browse files")).toBeTruthy();
  });

  it("calls onClick when card is clicked", () => {
    const onClick = vi.fn();
    renderWithChakra(<PathCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByText("Convert a file"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders children and back arrow when expanded", () => {
    const onCollapse = vi.fn();
    renderWithChakra(
      <PathCard {...defaultProps} expanded={true} onCollapse={onCollapse}>
        <div>Drop zone content</div>
      </PathCard>
    );
    expect(screen.getByText("Drop zone content")).toBeTruthy();
    expect(screen.queryByText("Browse files")).toBeNull();
    expect(screen.queryByText("Upload a geospatial file")).toBeNull();
  });

  it("calls onCollapse when back arrow is clicked", () => {
    const onCollapse = vi.fn();
    renderWithChakra(
      <PathCard {...defaultProps} expanded={true} onCollapse={onCollapse}>
        <div>Content</div>
      </PathCard>
    );
    fireEvent.click(screen.getByLabelText("Go back"));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it("hides description and CTA when faded", () => {
    renderWithChakra(<PathCard {...defaultProps} faded={true} />);
    expect(screen.getByText("Convert a file")).toBeTruthy();
    expect(screen.queryByText("Upload a geospatial file")).toBeNull();
    expect(screen.queryByText("Browse files")).toBeNull();
  });
});
