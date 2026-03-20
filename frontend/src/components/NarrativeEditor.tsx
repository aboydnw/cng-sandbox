import { Box, Flex, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

interface NarrativeEditorProps {
  title: string;
  narrative: string;
  onTitleChange: (title: string) => void;
  onNarrativeChange: (narrative: string) => void;
}

export function NarrativeEditor({
  title,
  narrative,
  onTitleChange,
  onNarrativeChange,
}: NarrativeEditorProps) {
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");

  function generatePrompt() {
    const prompt = `Context:
- This is a chapter titled "${title}" in a scrollytelling map story.

My rough notes:
"${roughNotes}"

Task: Write 2-3 paragraphs of narrative text for this chapter of a scrollytelling story about geospatial data. Use clear, accessible language suitable for a non-technical audience. Write in the style of a scientific narrative, not marketing copy. Output as markdown.`;

    navigator.clipboard?.writeText(prompt);
    setShowAiPrompt(false);
    setRoughNotes("");
  }

  return (
    <Flex direction="column" h="100%" p={3} gap={2}>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Chapter title"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          borderBottom: "1px solid #e2e8f0",
          padding: "4px 0",
          outline: "none",
          background: "transparent",
        }}
      />

      <Flex justify="space-between" align="center">
        <Text fontSize="10px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase">
          Narrative
        </Text>
        <Text fontSize="10px" color="gray.400">
          Markdown supported
        </Text>
      </Flex>

      <Textarea
        flex={1}
        value={narrative}
        onChange={(e) => onNarrativeChange(e.target.value)}
        placeholder="Write your narrative here... (markdown supported)"
        fontFamily="mono"
        fontSize="13px"
        resize="none"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="6px"
        p={3}
        _focus={{ borderColor: "blue.300", boxShadow: "none" }}
      />

      {showAiPrompt ? (
        <Box border="1px solid" borderColor="gray.200" borderRadius="6px" p={3}>
          <Text fontSize="12px" color="gray.600" mb={2}>
            What's the story here? (rough notes)
          </Text>
          <Textarea
            value={roughNotes}
            onChange={(e) => setRoughNotes(e.target.value)}
            placeholder="deforestation got way worse after 2015, especially near palm oil plantations..."
            fontSize="12px"
            rows={3}
            resize="none"
            mb={2}
          />
          <Flex gap={2} justify="flex-end">
            <Text
              as="button"
              fontSize="11px"
              color="gray.500"
              onClick={() => setShowAiPrompt(false)}
              cursor="pointer"
            >
              Cancel
            </Text>
            <Text
              as="button"
              fontSize="11px"
              color="blue.500"
              fontWeight={600}
              onClick={generatePrompt}
              cursor="pointer"
            >
              Copy prompt to clipboard
            </Text>
          </Flex>
        </Box>
      ) : (
        <Text
          as="button"
          fontSize="11px"
          color="gray.500"
          cursor="pointer"
          textAlign="left"
          onClick={() => setShowAiPrompt(true)}
          _hover={{ color: "blue.500" }}
        >
          ✨ Draft with AI
        </Text>
      )}
    </Flex>
  );
}
