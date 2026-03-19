import { Box, Flex, Link, Tabs, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { Dataset } from "../types";
import { detectCadence, formatDateRange } from "../utils/temporal";
import { daysUntilExpiry } from "../utils/format";

interface CreditsPanelProps {
  dataset: Dataset;
  gapCount?: number;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  exploreContent?: ReactNode;
  clientRenderContent?: ReactNode;
}

function formatBandLabel(dataset: Dataset): string | null {
  if (dataset.dataset_type !== "raster" || dataset.band_count == null) return null;
  const ci = dataset.color_interpretation ?? [];
  const isRgb = ci.length >= 3 && ci[0] === "red" && ci[1] === "green" && ci[2] === "blue";

  if (dataset.band_count === 1) {
    return `Single-band ${dataset.dtype ?? ""}`.trim();
  }
  if (isRgb && dataset.band_count === 3) {
    return "3-band RGB";
  }
  if (isRgb) {
    const extra = (dataset.band_names ?? []).slice(3).join(", ");
    return `${dataset.band_count}-band RGB${extra ? ` + ${extra}` : ""}`;
  }
  return `${dataset.band_count}-band`;
}

export function CreditsPanel({
  dataset,
  gapCount = 0,
  activeTab = "credits",
  onTabChange,
  exploreContent,
  clientRenderContent,
}: CreditsPanelProps) {
  const passedCount = dataset.validation_results.filter((v) => v.passed).length;
  const totalCount = dataset.validation_results.length;
  const allPassed = passedCount === totalCount;
  const days = daysUntilExpiry(dataset.created_at);

  const showTabs =
    (dataset.dataset_type === "vector" && dataset.parquet_url != null) ||
    !!clientRenderContent;

  const creditsContent = (
    <>
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
        mb={4}
      >
        How this was made
      </Text>

      {dataset.credits.map((credit) => (
        <Box key={credit.tool} mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text color="brand.brown" fontSize="13px" fontWeight={600}>
            {credit.role} {credit.tool}
          </Text>
          <Link
            href={credit.url}
            target="_blank"
            rel="noopener noreferrer"
            color="brand.orange"
            fontSize="12px"
            fontWeight={500}
          >
            {(() => { try { return new URL(credit.url).host.replace("www.", ""); } catch { return credit.url; } })()} →
          </Link>
        </Box>
      ))}

      <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
        <Text
          fontSize="11px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.textSecondary"
          fontWeight={600}
          mb={2}
        >
          Validation
        </Text>
        <Text
          color={allPassed ? "brand.success" : "red.500"}
          fontSize="13px"
          fontWeight={600}
        >
          {allPassed ? "✓" : "⚠"} {passedCount}/{totalCount} checks passed
        </Text>
      </Box>

      {dataset.dataset_type === "raster" && dataset.band_count != null && (
        <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text
            fontSize="11px"
            textTransform="uppercase"
            letterSpacing="1px"
            color="brand.textSecondary"
            fontWeight={600}
            mb={2}
          >
            Raster
          </Text>
          <Text color="brand.brown" fontSize="13px" fontWeight={600}>
            {formatBandLabel(dataset)}
          </Text>
        </Box>
      )}

      {dataset.is_temporal && dataset.timesteps.length > 0 && (
        <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text
            fontSize="11px"
            textTransform="uppercase"
            letterSpacing="1px"
            color="brand.textSecondary"
            fontWeight={600}
            mb={2}
          >
            Temporal
          </Text>
          <Text color="brand.brown" fontSize="13px" fontWeight={600}>
            {gapCount > 0
              ? `${dataset.timesteps.length} of ${dataset.timesteps.length + gapCount} timesteps available`
              : `${dataset.timesteps.length} timesteps`}
            {" · "}
            {formatDateRange(
              dataset.timesteps.map((t) => t.datetime),
              detectCadence(dataset.timesteps.map((t) => t.datetime)),
            )}
          </Text>
        </Box>
      )}

      <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
        <Text
          fontSize="11px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.textSecondary"
          fontWeight={600}
          mb={2}
        >
          What's next
        </Text>
        <Link
          display="block"
          color="brand.orange"
          fontSize="13px"
          fontWeight={600}
          mb={2}
          href="https://developmentseed.org/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Turn this into a story →
        </Link>
        <Link
          display="block"
          color="brand.orange"
          fontSize="13px"
          fontWeight={500}
          href="https://developmentseed.org/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Talk to Development Seed →
        </Link>
      </Box>

      <Text color="brand.textSecondary" fontSize="12px">
        ⏳ Expires in {days} day{days !== 1 ? "s" : ""}
      </Text>
    </>
  );

  if (!showTabs) {
    return (
      <Box
        w="100%"
        h="100%"
        bg="white"
        borderLeft="1px solid"
        borderColor="brand.border"
        p={6}
        overflowY="auto"
      >
        {creditsContent}
      </Box>
    );
  }

  return (
    <Box
      w="100%"
      h="100%"
      bg="white"
      borderLeft="1px solid"
      borderColor="brand.border"
      overflowY="auto"
    >
      <Tabs.Root value={activeTab} onValueChange={(e) => onTabChange?.(e.value)}>
        <Tabs.List>
          <Tabs.Trigger value="credits">Credits</Tabs.Trigger>
          {exploreContent && <Tabs.Trigger value="explore">Explore</Tabs.Trigger>}
          {clientRenderContent && <Tabs.Trigger value="client">Client Rendering</Tabs.Trigger>}
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content value="credits">
          <Box p={6}>
            {creditsContent}
          </Box>
        </Tabs.Content>
        {exploreContent && (
          <Tabs.Content value="explore">
            {exploreContent}
          </Tabs.Content>
        )}
        {clientRenderContent && (
          <Tabs.Content value="client">
            {clientRenderContent}
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Box>
  );
}
