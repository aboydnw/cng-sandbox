import { useMemo } from "react";
import { format as d3Format } from "d3-format";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { ContinuousLegendConfig, LegendOrientation } from "./types";

interface ContinuousRampProps {
  config: ContinuousLegendConfig;
  orientation: LegendOrientation;
}

export function ContinuousRamp({ config, orientation }: ContinuousRampProps) {
  const {
    domain,
    colors,
    ticks: tickCount = 5,
    tickFormat = "~s",
    formatTick,
  } = config;
  const isHorizontal = orientation === "horizontal";

  const gradient = useMemo(() => {
    const stops = colors
      .map((c, i) => `${c} ${(i / Math.max(colors.length - 1, 1)) * 100}%`)
      .join(", ");
    return isHorizontal
      ? `linear-gradient(to right, ${stops})`
      : `linear-gradient(to top, ${stops})`;
  }, [colors, isHorizontal]);

  const ticks = useMemo(() => {
    const [min, max] = domain;
    if (tickCount <= 1) return [min];
    const step = (max - min) / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => min + step * i);
  }, [domain, tickCount]);

  const formatter = useMemo(
    () => formatTick ?? d3Format(tickFormat),
    [formatTick, tickFormat]
  );

  return (
    <Flex
      direction={isHorizontal ? "column" : "row"}
      gap={isHorizontal ? 1 : 2}
      alignItems={isHorizontal ? undefined : "stretch"}
    >
      <Box
        h={isHorizontal ? "12px" : "96px"}
        w={isHorizontal ? "full" : "12px"}
        rounded="sm"
        borderWidth="1px"
        borderColor="gray.200"
        _dark={{ borderColor: "gray.700" }}
        style={{ background: gradient }}
      />
      <Flex
        direction={isHorizontal ? "row" : "column"}
        justifyContent="space-between"
        fontSize="10px"
        color="gray.500"
        _dark={{ color: "gray.400" }}
      >
        {(isHorizontal ? ticks : [...ticks].reverse()).map((v) => (
          <Text as="span" key={v}>
            {formatter(v)}
          </Text>
        ))}
      </Flex>
    </Flex>
  );
}
