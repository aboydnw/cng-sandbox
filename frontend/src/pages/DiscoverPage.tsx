import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Box, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { workspaceFetch } from "../lib/api";
import { config } from "../config";
import type { Dataset } from "../types";
import {
  discoverCatalog,
  listingUrlForSlug,
  type CatalogEntry,
} from "../lib/discoverCatalog";
import { DiscoverHeader } from "../components/discover/DiscoverHeader";

const PAGE_BG = "#fafaf8";
const CARD_BG = "#ffffff";
const BORDER = "#e8e6e1";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#6b6b68";
const ACCENT = "#1a3a5c";

function findSupportedDatasetId(
  datasets: Dataset[],
  entry: CatalogEntry
): string | undefined {
  if (!entry.supported) return undefined;
  const target = listingUrlForSlug(entry.slug);
  const match = datasets.find(
    (d) =>
      d.is_example &&
      (d as Dataset & { source_url?: string }).source_url === target
  );
  return match?.id;
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  useEffect(() => {
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then((r) => r.json())
      .then((data) => setDatasets(Array.isArray(data) ? data : []))
      .catch(() => setDatasets([]));
  }, []);

  const onCardClick = (entry: CatalogEntry) => {
    navigate(workspacePath(`/discover/${entry.slug}`));
  };

  return (
    <Box minH="100vh" bg={PAGE_BG} color={TEXT}>
      <DiscoverHeader />

      <Box maxW="1100px" mx="auto" px={6} pt={10} pb={6}>
        <Heading
          as="h1"
          fontSize={{ base: "28px", md: "36px" }}
          fontWeight={600}
          letterSpacing="-0.02em"
          mb={3}
          color={TEXT}
        >
          Discover geospatial data
        </Heading>
        <Text
          fontSize="17px"
          color={TEXT_MUTED}
          maxW="720px"
          lineHeight={1.55}
          mb={8}
        >
          Curated, cloud-native datasets ready to visualize, combine, and turn
          into shareable map stories. Pick a dataset to preview it in the CNG
          Sandbox.
        </Text>
      </Box>

      <Box maxW="1100px" mx="auto" px={6} pb={20}>
        <Flex
          align="center"
          justify="space-between"
          mb={4}
          borderBottom="1px solid"
          borderColor={BORDER}
          pb={2}
        >
          <Text
            fontSize="12px"
            fontWeight={600}
            letterSpacing="0.08em"
            textTransform="uppercase"
            color={TEXT_MUTED}
          >
            Featured datasets
          </Text>
          <Text
            fontSize="12px"
            color={TEXT_MUTED}
            fontFamily="SFMono-Regular, Consolas, monospace"
          >
            {discoverCatalog.length} products
          </Text>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {discoverCatalog.map((entry) => {
            const datasetId = findSupportedDatasetId(datasets, entry);
            return (
              <CatalogCard
                key={entry.slug}
                entry={entry}
                ready={Boolean(datasetId)}
                onClick={() => onCardClick(entry)}
              />
            );
          })}
        </SimpleGrid>

        <Box mt={16} pt={8} borderTop="1px solid" borderColor={BORDER}>
          <Text fontSize="14px" color={TEXT_MUTED} lineHeight={1.6}>
            Want to publish your own dataset here?{" "}
            <Link
              to={workspacePath("/")}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Contribute to source.coop
            </Link>{" "}
            — upload a GeoTIFF, NetCDF, GeoJSON, Shapefile, or HDF5 and we'll
            convert it to a cloud-native format ready for publication.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

interface CatalogCardProps {
  entry: CatalogEntry;
  ready: boolean;
  onClick: () => void;
}

function CatalogCard({ entry, ready, onClick }: CatalogCardProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const fallbackLetter = entry.title.charAt(0).toUpperCase();

  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      bg={CARD_BG}
      border="1px solid"
      borderColor={BORDER}
      borderRadius="4px"
      overflow="hidden"
      cursor="pointer"
      transition="border-color 120ms ease, transform 120ms ease"
      _hover={{ borderColor: TEXT, transform: "translateY(-1px)" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: ACCENT,
        outlineOffset: "2px",
      }}
      display="flex"
      flexDirection="column"
    >
      <Box
        h="140px"
        bg="#efece6"
        borderBottom="1px solid"
        borderColor={BORDER}
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
            color={TEXT}
            fontSize="56px"
            fontWeight={300}
            letterSpacing="-0.04em"
            fontFamily="Georgia, serif"
          >
            {fallbackLetter}
          </Flex>
        ) : (
          <img
            src={entry.thumbnail}
            alt={entry.title}
            onError={() => setImageBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </Box>
      <Box p={4} flex="1" display="flex" flexDirection="column">
        <Text
          fontSize="11px"
          fontFamily="SFMono-Regular, Consolas, monospace"
          color={TEXT_MUTED}
          mb={1.5}
        >
          {entry.org}/{entry.name}
        </Text>
        <Text
          fontSize="16px"
          fontWeight={600}
          color={TEXT}
          mb={2}
          letterSpacing="-0.01em"
          lineHeight={1.3}
        >
          {entry.title}
        </Text>
        <Text
          fontSize="13px"
          color={TEXT_MUTED}
          lineHeight={1.5}
          mb={3}
          flex="1"
        >
          {entry.tagline}
        </Text>
        <Flex gap={1.5} wrap="wrap" mb={3}>
          {entry.tags.slice(0, 4).map((t) => (
            <Text
              key={t}
              fontSize="11px"
              fontFamily="SFMono-Regular, Consolas, monospace"
              color={TEXT_MUTED}
              border="1px solid"
              borderColor={BORDER}
              px={1.5}
              py={0.5}
              borderRadius="2px"
            >
              {t}
            </Text>
          ))}
        </Flex>
        <Flex align="center" justify="space-between">
          <Text
            fontSize="11px"
            fontFamily="SFMono-Regular, Consolas, monospace"
            color={TEXT_MUTED}
          >
            updated {entry.updated}
          </Text>
          {ready ? (
            <Text
              fontSize="11px"
              fontWeight={600}
              color={ACCENT}
              textTransform="uppercase"
              letterSpacing="0.05em"
            >
              ● Ready
            </Text>
          ) : entry.supported ? (
            <Text
              fontSize="11px"
              color={TEXT_MUTED}
              textTransform="uppercase"
              letterSpacing="0.05em"
            >
              Preparing…
            </Text>
          ) : (
            <Text
              fontSize="11px"
              color={TEXT_MUTED}
              textTransform="uppercase"
              letterSpacing="0.05em"
            >
              Browse
            </Text>
          )}
        </Flex>
      </Box>
    </Box>
  );
}
