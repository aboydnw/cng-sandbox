import { Link } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { useWorkspace } from "../hooks/useWorkspace";

export default function ExpiredPage() {
  const { workspacePath } = useWorkspace();

  return (
    <Box minH="100vh" bg="white">
      <Header />
      <Flex
        direction="column"
        align="center"
        justify="center"
        h="calc(100vh - 56px)"
        px={8}
      >
        <Flex
          align="center"
          justify="center"
          w="56px"
          h="56px"
          bg="brand.bgSubtle"
          borderRadius="full"
          mb={5}
          fontSize="24px"
        >
          ⏳
        </Flex>
        <Text color="brand.brown" fontSize="20px" fontWeight={700} mb={2}>
          This map has expired
        </Text>
        <Text
          color="brand.textSecondary"
          fontSize="14px"
          mb={7}
          maxW="340px"
          textAlign="center"
          lineHeight={1.5}
        >
          Sandbox maps are available for 30 days. Re-upload your data or talk to
          us about a permanent solution.
        </Text>
        <Flex gap={3}>
          <Button
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
            asChild
          >
            <Link to={workspacePath("/")}>Upload again</Link>
          </Button>
          <Button
            bg="brand.bgSubtle"
            color="brand.brown"
            fontWeight={500}
            borderRadius="4px"
            asChild
          >
            <a
              href="https://developmentseed.org/contact"
              target="_blank"
              rel="noopener noreferrer"
            >
              Talk to Dev Seed
            </a>
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
