import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowSquareOut } from "@phosphor-icons/react";

const EARTH_STORIES_URL = "https://github.com/aboydnw/earth-stories";

export function EarthStoriesCta() {
  return (
    <Box
      as="aside"
      bg="brand.bgSubtle"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="md"
      p={4}
    >
      <Heading size="sm" color="brand.brown" mb={1}>
        Build a story with Earth Stories
      </Heading>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall" mb={3}>
        Turn this map into a narrative with maps, text, charts, images, and
        video.
      </Text>
      <Box
        asChild
        color="brand.orange"
        fontSize="sm"
        fontWeight={600}
        textDecoration="none"
        _hover={{ textDecoration: "underline" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "brand.orange" }}
      >
        <a
          href={EARTH_STORIES_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Flex as="span" align="center" gap={1}>
            Explore Earth Stories on GitHub
            <ArrowSquareOut size={15} aria-hidden="true" />
          </Flex>
        </a>
      </Box>
    </Box>
  );
}
