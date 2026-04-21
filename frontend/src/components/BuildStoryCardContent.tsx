import { useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";

export function BuildStoryCardContent() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const [error, setError] = useState<string | null>(null);

  const handleStartFromScratch = () => {
    setError(null);
    navigate(workspacePath("/story/new"));
  };

  return (
    <Box>
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
