import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export default function WorkspaceHomePage() {
  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4} w="100%" flex="1">
        <Heading size="lg" color="gray.800" mb={4}>
          Workspace home
        </Heading>
        <Text color="gray.600">Dashboard coming in Task 4.</Text>
      </Box>
      <Footer />
    </Flex>
  );
}
