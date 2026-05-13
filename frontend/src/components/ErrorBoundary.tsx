import { Component, type ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { ArrowClockwise, BugBeetle, GithubLogo } from "@phosphor-icons/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const ISSUE_URL = "https://github.com/aboydnw/cng-sandbox/issues/new";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || "An unexpected error occurred";

    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        minH="100vh"
        bg="white"
        px={8}
        py={12}
      >
        <Flex
          align="center"
          justify="center"
          w="56px"
          h="56px"
          bg="brand.bgSubtle"
          borderRadius="full"
          mb={5}
          color="brand.brown"
        >
          <BugBeetle size={24} weight="duotone" />
        </Flex>
        <Text color="brand.brown" fontSize="20px" fontWeight={700} mb={2}>
          Something went wrong
        </Text>
        <Text
          color="brand.textSecondary"
          fontSize="14px"
          mb={5}
          maxW="420px"
          textAlign="center"
          lineHeight={1.5}
        >
          Try refreshing the page. If the problem persists, please open an issue
          on GitHub so we can fix it.
        </Text>
        <Box
          maxW="420px"
          w="100%"
          mb={7}
          px={3}
          py={2}
          bg="brand.bgSubtle"
          borderWidth="1px"
          borderColor="brand.border"
          borderRadius="4px"
        >
          <Text
            color="brand.brown"
            fontSize="12px"
            fontFamily="mono"
            textAlign="center"
            wordBreak="break-word"
          >
            {message}
          </Text>
        </Box>
        <Flex gap={3}>
          <Button
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={() => window.location.reload()}
          >
            <ArrowClockwise size={16} weight="bold" />
            Refresh page
          </Button>
          <Button
            bg="brand.bgSubtle"
            color="brand.brown"
            fontWeight={500}
            borderRadius="4px"
            asChild
          >
            <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
              <GithubLogo size={16} weight="bold" />
              Report on GitHub
            </a>
          </Button>
        </Flex>
      </Flex>
    );
  }
}
