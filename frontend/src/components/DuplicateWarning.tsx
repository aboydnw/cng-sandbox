import { Box, Flex, Text } from "@chakra-ui/react";
import { Warning } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";

interface DuplicateWarningProps {
  filename: string;
  onUploadAnother: () => void;
}

export function DuplicateWarning({
  filename,
  onUploadAnother,
}: DuplicateWarningProps) {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();

  return (
    <Box>
      <Flex align="center" gap={2} mb={3}>
        <Warning
          size={20}
          weight="fill"
          color="var(--chakra-colors-orange-500)"
        />
        <Text fontSize="14px" fontWeight={600} color="brand.text">
          A file named &ldquo;{filename}&rdquo; already exists in your library.
        </Text>
      </Flex>
      <Flex gap={3}>
        <Box
          as="button"
          onClick={() => navigate(workspacePath("/library"))}
          bg="brand.orange"
          color="white"
          px={4}
          py={2}
          borderRadius="8px"
          fontSize="13px"
          fontWeight={600}
          cursor="pointer"
          _hover={{ bg: "brand.orangeHover" }}
          transition="background 150ms ease"
        >
          Go to Library
        </Box>
        <Box
          as="button"
          onClick={onUploadAnother}
          bg="transparent"
          color="brand.text"
          px={4}
          py={2}
          borderRadius="8px"
          fontSize="13px"
          fontWeight={600}
          cursor="pointer"
          border="1px solid"
          borderColor="brand.border"
          _hover={{ bg: "brand.bgSubtle" }}
          transition="background 150ms ease"
        >
          Upload another file
        </Box>
      </Flex>
    </Box>
  );
}
