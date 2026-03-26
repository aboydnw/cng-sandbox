import { Box, Flex, Text } from "@chakra-ui/react";
import { transition } from "../lib/interactionStyles";

type VectorRenderMode = "vector-tiles" | "geojson";

interface VectorSidebarControlsProps {
  renderMode: VectorRenderMode;
  onRenderModeChange: (mode: VectorRenderMode) => void;
  hasParquet: boolean;
}

export function VectorSidebarControls({
  renderMode,
  onRenderModeChange,
  hasParquet,
}: VectorSidebarControlsProps) {
  return (
    <Box mb={3}>
      <Text
        fontSize="11px"
        color="brand.textSecondary"
        fontWeight={600}
        textTransform="uppercase"
        letterSpacing="1px"
        mb={3}
      >
        View Mode
      </Text>
      <Flex gap={2}>
        <ModeButton
          label="Vector Tiles"
          active={renderMode === "vector-tiles"}
          onClick={() => onRenderModeChange("vector-tiles")}
        />
        {hasParquet && (
          <ModeButton
            label="GeoParquet"
            active={renderMode === "geojson"}
            onClick={() => onRenderModeChange("geojson")}
          />
        )}
      </Flex>
    </Box>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      as="button"
      flex={1}
      py={1.5}
      fontSize="12px"
      fontWeight={500}
      borderRadius="6px"
      border="1px solid"
      borderColor={active ? "brand.orange" : "brand.border"}
      bg={active ? "brand.orange" : "white"}
      color={active ? "white" : "brand.brown"}
      cursor="pointer"
      transition={transition(150)}
      _hover={{
        borderColor: "brand.orange",
        color: active ? "white" : "brand.orange",
      }}
      onClick={onClick}
    >
      {label}
    </Box>
  );
}
