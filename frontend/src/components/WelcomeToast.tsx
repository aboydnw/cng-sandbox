import { useEffect, useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Rocket } from "@phosphor-icons/react";

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
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.400"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={dismiss}
    >
      <Box
        bg="white"
        borderRadius="xl"
        shadow="2xl"
        p={8}
        maxW="380px"
        w="90vw"
        textAlign="center"
        onClick={(e) => e.stopPropagation()}
      >
        <Flex
          justify="center"
          align="center"
          w="56px"
          h="56px"
          borderRadius="full"
          bg="orange.50"
          mx="auto"
          mb={4}
        >
          <Rocket size={28} weight="duotone" color="#CF3F02" />
        </Flex>
        <Text fontWeight={700} fontSize="lg" mb={2} color="gray.800">
          Welcome to CNG Sandbox
        </Text>
        <Text fontSize="sm" color="gray.500" mb={5} lineHeight="tall">
          We've created a private workspace for you. Your data is only visible
          to people you share the link with. Bookmark this page to come back
          later.
        </Text>
        <Button
          size="sm"
          bg="brand.orange"
          color="white"
          _hover={{ bg: "brand.orangeHover" }}
          onClick={dismiss}
          w="full"
        >
          Start exploring
        </Button>
      </Box>
    </Box>
  );
}
