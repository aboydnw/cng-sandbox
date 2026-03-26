import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { LegendLayerConfig } from "./types";

interface LegendItemProps {
  config: LegendLayerConfig;
  collapsible: boolean;
  headingLevel: 3 | 4 | 5 | 6;
  onToggle?: (visible: boolean) => void;
  children: React.ReactNode;
}

const resetButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

export function LegendItem({
  config,
  collapsible,
  headingLevel,
  onToggle,
  children,
}: LegendItemProps) {
  const [expanded, setExpanded] = useState(true);
  const title =
    config.type === "continuous" && config.unit
      ? `${config.title} (${config.unit})`
      : config.title;

  return (
    <Box
      as="section"
      borderBottomWidth="1px"
      borderColor="gray.200"
      pb={2}
      _last={{ borderBottomWidth: 0, pb: 0 }}
      _dark={{ borderColor: "gray.700" }}
    >
      <Flex alignItems="center" gap={2} mb={2}>
        {onToggle ? (
          <button
            type="button"
            style={{
              ...resetButtonStyle,
              height: "14px",
              width: "14px",
              borderRadius: "4px",
              border: `1px solid ${config.visible === false ? "#e5e7eb" : "#3b82f6"}`,
              background: config.visible === false ? "white" : "#3b82f6",
              flexShrink: 0,
            }}
            onClick={() => onToggle(config.visible === false)}
            aria-label={`Toggle ${config.title} visibility`}
            aria-pressed={config.visible !== false}
          />
        ) : null}

        {collapsible ? (
          <button
            type="button"
            style={{ ...resetButtonStyle, gap: "4px", textAlign: "left" }}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <Text
              as="span"
              fontSize="12px"
              fontWeight="semibold"
              color="gray.800"
              aria-level={headingLevel}
              role="heading"
              _dark={{ color: "gray.50" }}
            >
              {title}
            </Text>
            <Text as="span" color="gray.500" _dark={{ color: "gray.400" }}>
              {expanded ? "▾" : "▸"}
            </Text>
          </button>
        ) : (
          <Text
            as="span"
            fontSize="12px"
            fontWeight="semibold"
            color="gray.800"
            aria-level={headingLevel}
            role="heading"
            _dark={{ color: "gray.50" }}
          >
            {title}
          </Text>
        )}
      </Flex>

      {expanded ? children : null}
    </Box>
  );
}
