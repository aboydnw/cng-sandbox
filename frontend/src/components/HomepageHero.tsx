import { Box, Text } from "@chakra-ui/react";

export function HomepageHero() {
  return (
    <Box textAlign="center" pt={14} pb={4} px={8}>
      <Text color="brand.brown" fontSize="26px" fontWeight={700} lineHeight={1.3}>
        Test-drive the open source
        <br />
        geospatial stack
      </Text>
      <Text color="brand.textSecondary" fontSize="15px" mt={3}>
        Choose your starting point
      </Text>
    </Box>
  );
}
