import { useState } from "react";
import { Box, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { Globe } from "@phosphor-icons/react";
import {
  sourceCoopCatalog,
  type SourceCoopProduct,
} from "../lib/sourceCoopCatalog";
import {
  cardHover,
  cardActive,
  focusRing,
  transition,
} from "../lib/interactionStyles";

interface SourceCoopGalleryProps {
  onSelect: (slug: string) => void;
}

export function SourceCoopGallery({ onSelect }: SourceCoopGalleryProps) {
  return (
    <Box as="section" py={8}>
      <Flex align="center" gap={2} mb={2}>
        <Globe
          size={24}
          weight="duotone"
          color="var(--chakra-colors-brand-orange)"
        />
        <Heading
          as="h2"
          fontSize="20px"
          fontWeight={700}
          color="brand.brown"
          letterSpacing="-0.02em"
        >
          Start with source.coop
        </Heading>
      </Flex>
      <Text fontSize="14px" color="brand.textSecondary" mb={5}>
        Jump straight into exploring real datasets. Pick one to begin.
      </Text>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap={5}>
        {sourceCoopCatalog.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            onClick={() => onSelect(product.slug)}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
}

interface ProductCardProps {
  product: SourceCoopProduct;
  onClick: () => void;
}

function ProductCard({ product, onClick }: ProductCardProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const fallbackLetter = product.name.charAt(0).toUpperCase();

  return (
    <Box
      as="button"
      onClick={onClick}
      tabIndex={0}
      border="2px solid"
      borderColor="brand.border"
      borderRadius="16px"
      overflow="hidden"
      bg="white"
      textAlign="left"
      cursor="pointer"
      transition={transition(200)}
      _hover={cardHover}
      _active={cardActive}
      _focusVisible={focusRing}
      width="100%"
      display="block"
    >
      <Box
        h="140px"
        bg="brand.bgSubtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {imageBroken ? (
          <Flex
            align="center"
            justify="center"
            w="100%"
            h="100%"
            bg="brand.brown"
            color="white"
            fontSize="48px"
            fontWeight={700}
            letterSpacing="-0.04em"
          >
            {fallbackLetter}
          </Flex>
        ) : (
          <img
            src={product.thumbnail}
            alt={product.name}
            onError={() => setImageBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </Box>
      <Box p={4}>
        <Text
          fontSize="15px"
          fontWeight={700}
          color="brand.brown"
          mb={1.5}
          letterSpacing="-0.02em"
        >
          {product.name}
        </Text>
        <Text fontSize="13px" color="brand.textSecondary" lineHeight={1.5}>
          {product.description}
        </Text>
      </Box>
    </Box>
  );
}
