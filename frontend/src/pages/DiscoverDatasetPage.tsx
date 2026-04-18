import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowSquareOut, MapTrifold, Upload } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { workspaceFetch } from "../lib/api";
import { config } from "../config";
import type { Dataset } from "../types";
import { getCatalogEntry, listingUrlForSlug } from "../lib/discoverCatalog";
import { DiscoverHeader } from "../components/discover/DiscoverHeader";

const PAGE_BG = "#fafaf8";
const BORDER = "#e8e6e1";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#6b6b68";
const ACCENT = "#1a3a5c";
const MONO = "SFMono-Regular, Consolas, monospace";

export default function DiscoverDatasetPage() {
  const { org, name } = useParams<{ org: string; name: string }>();
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const slug = `${org}/${name}`;
  const entry = useMemo(() => getCatalogEntry(slug), [slug]);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then((r) => r.json())
      .then((data) => {
        setDatasets(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (!entry) {
    return (
      <Box minH="100vh" bg={PAGE_BG} color={TEXT}>
        <DiscoverHeader />
        <Box maxW="1100px" mx="auto" px={6} py={16} textAlign="center">
          <Heading fontSize="28px" fontWeight={600} mb={2}>
            Product not found
          </Heading>
          <Text color={TEXT_MUTED} mb={6}>
            <Text as="span" fontFamily={MONO}>
              {slug}
            </Text>{" "}
            isn't in the discover catalog.
          </Text>
          <Link
            to={workspacePath("/discover")}
            style={{ color: ACCENT, textDecoration: "underline" }}
          >
            Back to discover
          </Link>
        </Box>
      </Box>
    );
  }

  const matched = datasets.find(
    (d) =>
      d.is_example &&
      (d as Dataset & { source_url?: string }).source_url ===
        listingUrlForSlug(entry.slug)
  );
  const datasetId = matched?.id;
  const ready = Boolean(datasetId);

  const onVisualize = () => {
    if (!datasetId) return;
    navigate(workspacePath(`/map/${datasetId}`));
  };

  return (
    <Box minH="100vh" bg={PAGE_BG} color={TEXT}>
      <DiscoverHeader />

      <Box maxW="1100px" mx="auto" px={6} pt={8} pb={20}>
        <Text fontSize="12px" fontFamily={MONO} color={TEXT_MUTED} mb={6}>
          <Link
            to={workspacePath("/discover")}
            style={{ color: TEXT_MUTED, textDecoration: "underline" }}
          >
            discover
          </Link>{" "}
          / {entry.org} /{" "}
          <Text as="span" color={TEXT}>
            {entry.name}
          </Text>
        </Text>

        <Flex align="flex-start" gap={3} mb={2}>
          <Heading
            as="h1"
            fontSize={{ base: "28px", md: "34px" }}
            fontWeight={600}
            letterSpacing="-0.02em"
            lineHeight={1.2}
            color={TEXT}
            flex="1"
          >
            {entry.title}
          </Heading>
        </Flex>

        <Text
          fontSize="17px"
          color={TEXT_MUTED}
          lineHeight={1.55}
          maxW="720px"
          mb={5}
        >
          {entry.tagline}
        </Text>

        <Flex
          gap={4}
          wrap="wrap"
          align="center"
          pb={5}
          mb={8}
          borderBottom="1px solid"
          borderColor={BORDER}
          fontFamily={MONO}
          fontSize="12px"
          color={TEXT_MUTED}
        >
          <Text>
            org · <Text as="span" color={TEXT}>{entry.org}</Text>
          </Text>
          <Text>
            license · <Text as="span" color={TEXT}>{entry.license}</Text>
          </Text>
          <Text>
            updated · <Text as="span" color={TEXT}>{entry.updated}</Text>
          </Text>
          <Flex gap={1.5} wrap="wrap">
            {entry.tags.map((t) => (
              <Text
                key={t}
                border="1px solid"
                borderColor={BORDER}
                px={1.5}
                py={0.5}
                borderRadius="2px"
                color={TEXT_MUTED}
              >
                {t}
              </Text>
            ))}
          </Flex>
        </Flex>

        <Flex gap={8} direction={{ base: "column", md: "row" }}>
          <Box flex="1" minW={0}>
            <ReadmeBlock content={entry.readme} />

            <Box mt={10}>
              <Text
                fontSize="12px"
                fontWeight={600}
                letterSpacing="0.08em"
                textTransform="uppercase"
                color={TEXT_MUTED}
                mb={3}
                pb={2}
                borderBottom="1px solid"
                borderColor={BORDER}
              >
                Files
              </Text>
              {entry.files.map((f, i) => (
                <Flex
                  key={i}
                  justify="space-between"
                  py={2}
                  borderBottom="1px solid"
                  borderColor={BORDER}
                  fontFamily={MONO}
                  fontSize="13px"
                >
                  <Text color={f.path === "…" ? TEXT_MUTED : TEXT}>
                    {f.path}
                  </Text>
                  <Text color={TEXT_MUTED}>{f.size}</Text>
                </Flex>
              ))}
            </Box>
          </Box>

          <Box w={{ base: "100%", md: "300px" }} flexShrink={0}>
            <Box
              bg="white"
              border="1px solid"
              borderColor={BORDER}
              borderRadius="4px"
              p={4}
              position="sticky"
              top={4}
            >
              <Text
                fontSize="11px"
                fontWeight={600}
                letterSpacing="0.08em"
                textTransform="uppercase"
                color={TEXT_MUTED}
                mb={3}
              >
                Actions
              </Text>

              {entry.supported ? (
                <Box
                  as="button"
                  onClick={onVisualize}
                  disabled={!ready}
                  w="100%"
                  bg={ready ? TEXT : "#d0d0cc"}
                  color="white"
                  borderRadius="3px"
                  py={2.5}
                  px={3}
                  fontSize="13px"
                  fontWeight={600}
                  cursor={ready ? "pointer" : "not-allowed"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                  mb={2}
                  transition="background 120ms ease"
                  _hover={ready ? { bg: ACCENT } : undefined}
                >
                  <MapTrifold size={16} weight="bold" />
                  {loading
                    ? "Loading…"
                    : ready
                      ? "Visualize in sandbox"
                      : "Preparing…"}
                </Box>
              ) : (
                <Box
                  w="100%"
                  bg="#f0ede7"
                  color={TEXT_MUTED}
                  borderRadius="3px"
                  py={2.5}
                  px={3}
                  fontSize="12px"
                  textAlign="center"
                  mb={2}
                  lineHeight={1.5}
                >
                  Not yet wired into the sandbox. Upload a sample to explore it
                  here.
                </Box>
              )}

              <Box
                as="a"
                href={entry.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                w="100%"
                bg="white"
                color={TEXT}
                border="1px solid"
                borderColor={BORDER}
                borderRadius="3px"
                py={2.5}
                px={3}
                fontSize="13px"
                fontWeight={500}
                _hover={{ borderColor: TEXT }}
                mb={3}
                textDecoration="none"
              >
                <ArrowSquareOut size={14} />
                View on source.coop
              </Box>

              <Box h="1px" bg={BORDER} my={4} />

              <Text
                fontSize="11px"
                fontWeight={600}
                letterSpacing="0.08em"
                textTransform="uppercase"
                color={TEXT_MUTED}
                mb={2}
              >
                Quick facts
              </Text>
              <Box fontSize="12px" fontFamily={MONO} lineHeight={1.8}>
                <FactRow label="slug" value={entry.slug} />
                <FactRow label="files" value={String(entry.files.length)} />
                <FactRow label="license" value={entry.license} />
                <FactRow label="updated" value={entry.updated} />
              </Box>

              <Box h="1px" bg={BORDER} my={4} />

              <Text fontSize="12px" color={TEXT_MUTED} lineHeight={1.5} mb={2}>
                Have your own data to combine with this?
              </Text>
              <Link
                to={workspacePath("/")}
                style={{ textDecoration: "none" }}
              >
                <Flex
                  align="center"
                  gap={1.5}
                  fontSize="12px"
                  color={ACCENT}
                  _hover={{ textDecoration: "underline" }}
                >
                  <Upload size={12} weight="bold" />
                  Upload a file
                </Flex>
              </Link>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <Flex justify="space-between" gap={3}>
      <Text color={TEXT_MUTED}>{label}</Text>
      <Text color={TEXT} textAlign="right" truncate>
        {value}
      </Text>
    </Flex>
  );
}

function ReadmeBlock({ content }: { content: string }) {
  const blocks = content.trim().split(/\n\n+/);
  return (
    <Box fontSize="15px" lineHeight={1.65} color={TEXT}>
      {blocks.map((block, i) => {
        const heading = block.match(/^##\s+(.*)/);
        if (heading) {
          return (
            <Heading
              key={i}
              as="h2"
              fontSize="18px"
              fontWeight={600}
              letterSpacing="-0.01em"
              mt={6}
              mb={3}
              color={TEXT}
            >
              {heading[1]}
            </Heading>
          );
        }
        return (
          <Text key={i} mb={4} color={TEXT}>
            {renderInline(block)}
          </Text>
        );
      })}
    </Box>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text
          key={i}
          as="code"
          fontFamily={MONO}
          fontSize="13px"
          bg="#f0ede7"
          px={1.5}
          py={0.5}
          borderRadius="2px"
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
