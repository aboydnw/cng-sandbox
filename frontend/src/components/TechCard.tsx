import { Box, Link, Text } from "@chakra-ui/react";
import type { TechDescription } from "../lib/techDescriptions";

interface TechCardProps {
  tech: TechDescription;
}

export function TechCard({ tech }: TechCardProps) {
  return (
    <Box flex="1" bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4} borderTopWidth="2px" borderTopColor="brand.orange">
      <Text fontSize="11px" color="brand.orange" textTransform="uppercase" letterSpacing="1px" fontWeight={600}>
        {tech.role}
      </Text>
      <Text fontSize="13px" color="brand.brown" fontWeight={700} mt={1}>
        {tech.name}
      </Text>
      <Text fontSize="12px" color="brand.textSecondary" lineHeight="1.6" mt={1}>
        {tech.description}
      </Text>
      <Link href={tech.url} target="_blank" rel="noopener noreferrer" fontSize="12px" color="brand.orange" fontWeight={600} mt={2} display="block">
        View repo ↗
      </Link>
    </Box>
  );
}
