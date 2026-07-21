import { Box, Heading, Text } from "@chakra-ui/react";

export function HomepageHero() {
  return (
    <Box textAlign="center" pt={8} pb={2} px={8}>
      <Heading
        color="brand.brown"
        fontSize="26px"
        fontWeight={700}
        lineHeight={1.3}
        letterSpacing="-0.02em"
      >
        Create a map from your data
      </Heading>
      <Text
        color="brand.textSecondary"
        fontSize="15px"
        mt={3}
        maxW="65ch"
        mx="auto"
      >
        Upload a local file or connect a cloud source. We’ll identify the format
        and guide you through the next step.
      </Text>
    </Box>
  );
}
