import { Box, Link, Text } from "@chakra-ui/react";
import type { TechDescription } from "../lib/techDescriptions";

interface TechCardProps {
  tech: TechDescription;
}

export function TechCard({ tech }: TechCardProps) {
  return (
    <Box flex="1" bg="gray.800" borderRadius="md" p={4} borderTopWidth="2px" borderColor="brand.orange">
      <Text fontSize="xs" color="brand.orange" textTransform="uppercase" letterSpacing="wide" fontWeight="bold">
        {tech.role}
      </Text>
      <Text fontSize="sm" color="white" fontWeight="bold" mt={1}>
        {tech.name}
      </Text>
      <Text fontSize="xs" color="gray.400" lineHeight="tall" mt={1}>
        {tech.description}
      </Text>
      <Link href={tech.url} target="_blank" rel="noopener noreferrer" fontSize="xs" color="brand.orange" mt={2} display="block">
        View repo ↗
      </Link>
    </Box>
  );
}
