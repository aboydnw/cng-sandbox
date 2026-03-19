import { Component, type ReactNode } from "react";
import { Box, Heading, Text, Button } from "@chakra-ui/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} textAlign="center">
          <Heading size="lg" mb={4}>
            Something went wrong
          </Heading>
          <Text mb={4} color="gray.600">
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
