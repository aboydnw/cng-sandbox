import { useCallback, useRef, useState } from "react";
import { Box, Flex, IconButton, Input, Portal, Text } from "@chakra-ui/react";
import { PaperPlaneRight, X } from "@phosphor-icons/react";
import type {
  AgentBridge,
  ApiMessage,
  ChatMessage,
  ChatTool,
  ToolChip,
} from "../../lib/chat/types";
import { runConversation } from "../../lib/chat/runConversation";
import { streamChat } from "../../lib/chat/streamChat";
import { navigationTools } from "../../lib/chat/tools/navigation";
import { dataTools } from "../../lib/chat/tools/data";

// Registered client-side tools: navigation/map control + data reads.
const tools: ChatTool[] = [...navigationTools, ...dataTools];

interface ChatPanelProps {
  storyId: string;
  bridgeRef: React.RefObject<AgentBridge | null>;
  onClose: () => void;
}

export function ChatPanel({ storyId, bridgeRef, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<ApiMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const appendToAssistant = useCallback(
    (mutate: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = mutate({ ...last });
        }
        return next;
      });
    },
    []
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "", chips: [] },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const finalMessages = await runConversation({
        userText: text,
        history: historyRef.current,
        tools,
        bridge: bridgeRef.current as AgentBridge,
        streamChat: (args) => streamChat({ storyId, ...args }),
        signal: controller.signal,
        onText: (delta) =>
          appendToAssistant((msg) => ({ ...msg, text: msg.text + delta })),
        onToolChip: (chip: ToolChip) =>
          appendToAssistant((msg) => ({
            ...msg,
            chips: [...(msg.chips ?? []), chip],
          })),
        onDone: () => {},
        onError: (message) => setError(message),
      });
      historyRef.current = finalMessages;
    } catch (e) {
      // A user-initiated Stop aborts the fetch; that's not a failure to surface.
      if (
        controller.signal.aborted ||
        (e instanceof Error && e.name === "AbortError")
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, storyId, bridgeRef, appendToAssistant]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return (
    <Portal>
      <Flex
        data-testid="chat-panel"
        direction="column"
        position="fixed"
        top={0}
        right={0}
        h="100vh"
        w={{ base: "100%", md: "400px" }}
        bg="white"
        borderLeft="1px solid"
        borderColor="brand.border"
        shadow="xl"
        zIndex={1200}
      >
        <Flex
          align="center"
          justify="space-between"
          px={4}
          py={3}
          borderBottom="1px solid"
          borderColor="brand.border"
        >
          <Text fontWeight={600} color="brand.brown">
            Ask this map
          </Text>
          <IconButton
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
            _hover={{ bg: "brand.bgSubtle", color: "brand.orange" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "brand.border",
            }}
          >
            <X size={18} />
          </IconButton>
        </Flex>

        <Box flex={1} overflowY="auto" px={4} py={3} aria-live="polite">
          {messages.length === 0 && (
            <Text fontSize="sm" color="gray.500">
              Ask a question about this story&apos;s data. The assistant can
              move the map, toggle layers, and read values for you.
            </Text>
          )}
          {messages.map((msg, i) => (
            <Box key={i} mb={4}>
              <Text
                fontSize="10px"
                textTransform="uppercase"
                letterSpacing="1px"
                color={msg.role === "user" ? "brand.brown" : "brand.orange"}
                fontWeight={600}
                mb={1}
              >
                {msg.role === "user" ? "You" : "Assistant"}
              </Text>
              {msg.chips && msg.chips.length > 0 && (
                <Flex direction="column" gap={1} mb={2}>
                  {msg.chips.map((chip, ci) => (
                    <Text
                      key={ci}
                      data-testid="tool-chip"
                      fontSize="xs"
                      color={chip.isError ? "red.fg" : "gray.600"}
                      bg="brand.bgSubtle"
                      px={2}
                      py={1}
                      borderRadius="6px"
                    >
                      → {chip.summary}
                    </Text>
                  ))}
                </Flex>
              )}
              <Text fontSize="sm" color="gray.800" whiteSpace="pre-wrap">
                {msg.text}
              </Text>
            </Box>
          ))}
          {error && (
            <Text fontSize="sm" color="red.fg" mt={2}>
              {error}
            </Text>
          )}
        </Box>

        <Flex
          as="form"
          gap={2}
          px={4}
          py={3}
          borderTop="1px solid"
          borderColor="brand.border"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this map…"
            size="sm"
            disabled={streaming}
          />
          {streaming ? (
            <IconButton
              aria-label="Stop"
              size="sm"
              variant="outline"
              onClick={stop}
            >
              <X size={16} />
            </IconButton>
          ) : (
            <IconButton
              aria-label="Send"
              type="submit"
              size="sm"
              bg="brand.orange"
              color="white"
              _hover={{ bg: "brand.brown" }}
            >
              <PaperPlaneRight size={16} />
            </IconButton>
          )}
        </Flex>
      </Flex>
    </Portal>
  );
}
