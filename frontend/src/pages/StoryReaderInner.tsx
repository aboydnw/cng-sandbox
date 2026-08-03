import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { StoryRenderer } from "../components/StoryRenderer";
import { BugReportLink } from "../components/BugReportLink";
import { AskThisMapButton } from "../components/chat/AskThisMapButton";
import { ChatPanel } from "../components/chat/ChatPanel";
import { useChatConfig } from "../lib/chat/useChatConfig";
import type { AgentBridge } from "../lib/chat/types";
import type { Story } from "../lib/story";
import type { Connection, Dataset } from "../types";
import { StoryProgress } from "../components/StoryProgress";

interface StoryReaderInnerProps {
  story: Story;
  datasetMap: Map<string, Dataset | null>;
  connectionMap: Map<string, Connection>;
  embed?: boolean;
  shared?: boolean;
  chatEligible?: boolean;
}

export function StoryReaderInner({
  story,
  datasetMap,
  connectionMap,
  embed = false,
  shared = false,
  chatEligible = false,
}: StoryReaderInnerProps) {
  const agentBridgeRef = useRef<AgentBridge | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const { enabled: chatEnabled } = useChatConfig();
  const showChat = chatEligible && chatEnabled;

  const updateReadingProgress = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const remaining = element.scrollHeight - element.clientHeight;
    setReadingProgress(remaining <= 0 ? 1 : element.scrollTop / remaining);
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateReadingProgress();

    const observer = new ResizeObserver(updateReadingProgress);
    observer.observe(element);
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild);
    }
    window.addEventListener("resize", updateReadingProgress);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateReadingProgress);
    };
  }, [story, updateReadingProgress]);

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {!embed && (
        <Flex
          h="48px"
          px={5}
          align="center"
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="white"
          flexShrink={0}
        >
          <Heading size="sm" fontWeight={600} color="gray.800">
            {story.title}
          </Heading>
          {!shared && (
            <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
          )}
          <Text ml="auto" fontSize="xs" color="gray.500">
            Made with CNG Sandbox
          </Text>
        </Flex>
      )}

      <StoryProgress progress={readingProgress} />

      <Box
        ref={scrollRef}
        flex={1}
        overflowY="auto"
        onScroll={updateReadingProgress}
      >
        <StoryRenderer
          story={story}
          datasetMap={datasetMap}
          connectionMap={connectionMap}
          agentBridgeRef={agentBridgeRef}
        />
      </Box>

      {showChat && !chatOpen && (
        <AskThisMapButton onClick={() => setChatOpen(true)} />
      )}
      {showChat && chatOpen && (
        <ChatPanel
          storyId={story.id}
          bridgeRef={agentBridgeRef}
          onClose={() => setChatOpen(false)}
        />
      )}
    </Box>
  );
}
