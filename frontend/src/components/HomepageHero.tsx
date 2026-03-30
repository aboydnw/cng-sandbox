import { Box, Text } from "@chakra-ui/react";

export function HomepageHero() {
  return (
    <Box textAlign="center" pt={8} pb={2} px={8}>
      <Text
        color="brand.brown"
        fontSize="26px"
        fontWeight={700}
        lineHeight={1.3}
        letterSpacing="-0.02em"
      >
        Visualize your geospatial data
        <br />
        in the browser
      </Text>
      <Text
        color="brand.textSecondary"
        fontSize="15px"
        mt={3}
        maxW="65ch"
        mx="auto"
      >
        Convert, connect, or start building
      </Text>
    </Box>
  );
}
