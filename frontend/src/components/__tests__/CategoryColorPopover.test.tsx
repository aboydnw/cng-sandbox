import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { CategoryColorPopover } from "../CategoryColorPopover";

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("CategoryColorPopover", () => {
  it("calls onSave with the new color", () => {
    const onSave = vi.fn();
    renderWithProvider(
      <CategoryColorPopover
        color="#000000"
        defaultColor="#AAAAAA"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const hex = screen.getByLabelText(/hex/i) as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "#FF00FF" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith("#FF00FF");
  });

  it("reset restores default color", () => {
    const onSave = vi.fn();
    renderWithProvider(
      <CategoryColorPopover
        color="#000000"
        defaultColor="#AAAAAA"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("#AAAAAA");
  });

  it("rejects invalid hex on save", () => {
    const onSave = vi.fn();
    renderWithProvider(
      <CategoryColorPopover
        color="#000000"
        defaultColor="#AAAAAA"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const hex = screen.getByLabelText(/hex/i) as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must be a 6-digit hex/i)).toBeInTheDocument();
  });
});
