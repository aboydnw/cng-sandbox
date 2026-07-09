import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { useRef } from "react";
import { system } from "../../../theme";
import { ChatPanel } from "../ChatPanel";
import type { AgentBridge } from "../../../lib/chat/types";

vi.mock("../../../lib/chat/streamChat", () => ({
  streamChat: async function* () {
    yield { type: "text", text: "Hello from the map." };
    yield { type: "done" };
  },
}));

function Harness({ onClose }: { onClose: () => void }) {
  const bridgeRef = useRef<AgentBridge | null>(null);
  return <ChatPanel storyId="s1" bridgeRef={bridgeRef} onClose={onClose} />;
}

function renderPanel(onClose = vi.fn()) {
  return render(
    <ChakraProvider value={system}>
      <Harness onClose={onClose} />
    </ChakraProvider>
  );
}

describe("ChatPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the panel and closes via the X button", () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    expect(screen.getByTestId("chat-panel")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("streams an assistant reply after sending a message", async () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Ask about this map…"), {
      target: { value: "what is here?" },
    });
    fireEvent.click(screen.getByLabelText("Send"));
    await waitFor(() =>
      expect(screen.getByText("Hello from the map.")).toBeTruthy()
    );
  });
});
