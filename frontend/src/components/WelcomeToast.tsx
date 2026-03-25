import { useEffect, useState } from "react";
import { Box, Flex, Text, CloseButton } from "@chakra-ui/react";

const STORAGE_KEY = "welcomeToastDismissed";

export function WelcomeToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <Box
      position="fixed"
      bottom={4}
      left="50%"
      transform="translateX(-50%)"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      shadow="lg"
      p={4}
      maxW="480px"
      zIndex={1000}
    >
      <Flex justify="space-between" align="start" gap={3}>
        <Box>
          <Text fontWeight={600} fontSize="sm" mb={1}>
            Welcome to CNG Sandbox
          </Text>
          <Text fontSize="sm" color="gray.600">
            We've created a private workspace for you. Your data is only visible
            to people you share the link with. Bookmark this page to come back
            later.
          </Text>
        </Box>
        <CloseButton size="sm" onClick={dismiss} />
      </Flex>
    </Box>
  );
}
