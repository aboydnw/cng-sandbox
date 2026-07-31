import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { EmbedThemeControls } from "../EmbedThemeControls";

function renderControls(value = {}, onChange: (t: object) => void = () => {}) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <EmbedThemeControls value={value} onChange={onChange} />
    </ChakraProvider>
  );
}

describe("EmbedThemeControls", () => {
  it("renders font inputs backed by a shared datalist", () => {
    renderControls();
    expect(screen.getByLabelText(/body font/i)).toBeTruthy();
    expect(screen.getByLabelText(/heading font/i)).toBeTruthy();
    expect(document.getElementById("cng-google-fonts")).toBeTruthy();
    expect(
      document.querySelectorAll("#cng-google-fonts option").length
    ).toBeGreaterThanOrEqual(10);
  });

  it("emits onChange with the updated field", () => {
    const onChange = vi.fn();
    renderControls({}, onChange);
    fireEvent.change(screen.getByLabelText(/body font/i), {
      target: { value: "Libre Baskerville" },
    });
    expect(onChange).toHaveBeenCalledWith({ bodyFont: "Libre Baskerville" });
  });

  it("emits onChange with the accent color", () => {
    const onChange = vi.fn();
    renderControls({}, onChange);
    fireEvent.change(screen.getByLabelText(/accent color/i), {
      target: { value: "#2f6f4f" },
    });
    expect(onChange).toHaveBeenCalledWith({ accent: "#2f6f4f" });
  });

  it("shows a preview strip using the selected values", () => {
    renderControls({ bodyFont: "Inter", headingFont: "Lora", bg: "#eeeeee" });
    const preview = screen.getByTestId("embed-theme-preview");
    expect(preview.textContent).toContain("Chapter heading");
  });
});
