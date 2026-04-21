import { useState, useEffect } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { workspaceFetch } from "../lib/api";

interface ExampleStory {
  id: string;
  title: string;
  is_example?: boolean;
}

export function BuildStoryCardContent() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleStory[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    workspaceFetch("/api/stories", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: ExampleStory[]) => {
        setExamples(data.filter((s) => s.is_example));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleStartFromScratch = () => {
    setError(null);
    navigate(workspacePath("/story/new"));
  };

  const handleFork = async (storyId: string) => {
    setError(null);
    try {
      const r = await workspaceFetch(`/api/stories/${storyId}/fork`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const forked = await r.json();
      navigate(workspacePath(`/story/${forked.id}/edit`));
    } catch {
      setError("Failed to fork story. Please try again.");
    }
  };

  return (
    <Box>
      {examples.length > 0 && (
        <Box mb={3}>
          <Text fontSize="xs" color="brand.textSecondary" mb={1.5}>
            Start from a template
          </Text>
          <Flex gap={2} overflowX="auto" pb={1}>
            {examples.map((story) => (
              <Button
                key={story.id}
                size="xs"
                variant="outline"
                colorPalette="orange"
                flexShrink={0}
                onClick={() => handleFork(story.id)}
              >
                {story.title}
              </Button>
            ))}
          </Flex>
        </Box>
      )}

      <Button
        onClick={handleStartFromScratch}
        bg="brand.orange"
        color="white"
        px={5}
        py={2.5}
        borderRadius="10px"
        fontSize="14px"
        fontWeight={600}
        cursor="pointer"
        _hover={{ bg: "brand.orangeHover" }}
        transition="background 150ms ease"
        aria-label="Start from scratch"
      >
        Start from scratch
      </Button>

      {error && (
        <Text fontSize="xs" color="red.400" mt={2}>
          {error}
        </Text>
      )}
    </Box>
  );
}
