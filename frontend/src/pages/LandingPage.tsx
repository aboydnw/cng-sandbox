import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { ArrowRight, ArrowSquareOut, GithubLogo } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ExampleStoryCard } from "../components/ExampleStoryCard";
import {
  generateWorkspaceId,
  WORKSPACE_STORAGE_KEY,
} from "../hooks/useWorkspace";
import { listExampleStoriesFromServer } from "../lib/story/api";
import { seedExampleData } from "../lib/examples/api";
import { setWorkspaceId } from "../lib/api";
import { inferDataType } from "../lib/story/dataType";
import type { Story } from "../lib/story/types";
import { StatePanel } from "../components/ui/StatePanel";

const STORAGE_KEY = WORKSPACE_STORAGE_KEY;
const GITHUB_URL = "https://github.com/aboydnw/cng-sandbox";
const CONTACT_URL = "https://developmentseed.org/contact";

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const switching = searchParams.get("switch") === "1";
  const [enteredId, setEnteredId] = useState("");
  const [examples, setExamples] = useState<Story[]>([]);
  const [examplesStatus, setExamplesStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const cloneInFlightRef = useRef(false);

  useEffect(() => {
    if (switching) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      navigate(`/w/${stored}/`, { replace: true });
    }
  }, [switching, navigate]);

  const loadExamples = useCallback(() => {
    setExamplesStatus("loading");
    listExampleStoriesFromServer()
      .then((stories) => {
        setExamples(stories);
        setExamplesStatus("loaded");
      })
      .catch(() => setExamplesStatus("error"));
  }, []);

  useEffect(() => {
    loadExamples();
  }, [loadExamples]);

  const startStory = async () => {
    if (cloneInFlightRef.current) return;
    cloneInFlightRef.current = true;
    setStarting(true);
    const id = generateWorkspaceId();
    localStorage.setItem(STORAGE_KEY, id);
    setWorkspaceId(id);
    try {
      await seedExampleData(id);
    } catch {
      // Seeding is best-effort; the workspace still opens.
    }
    navigate(`/w/${id}/story/new`);
  };

  const openExampleStory = async (story: Story) => {
    if (cloneInFlightRef.current) return;
    cloneInFlightRef.current = true;
    setCloningId(story.id);
    const id = generateWorkspaceId();
    localStorage.setItem(STORAGE_KEY, id);
    setWorkspaceId(id);
    try {
      const { story_id_map } = await seedExampleData(id);
      const cloneId = story_id_map[story.id];
      if (!cloneId) {
        throw new Error("Seeded workspace is missing the example story clone");
      }
      navigate(`/w/${id}/story/${cloneId}/edit`);
    } catch {
      cloneInFlightRef.current = false;
      setCloningId(null);
      navigate(`/w/${id}/`);
    }
  };

  const openExistingWorkspace = () => {
    const trimmed = enteredId.trim();
    if (!trimmed) return;
    navigate(`/w/${trimmed}/`);
  };

  return (
    <Box minH="100vh" bg="brand.bgSubtle" display="flex" flexDirection="column">
      <Header showWorkspace={false} />

      <Box
        as="main"
        id="main-content"
        flex="1"
        px={{ base: 4, md: 6 }}
        py={{ base: 8, md: 14 }}
      >
        <Box
          maxW="1240px"
          mx="auto"
          display="grid"
          gridTemplateColumns={{
            base: "1fr",
            lg: "minmax(0, .85fr) minmax(480px, 1.15fr)",
          }}
          gap={{ base: 8, lg: 14 }}
          alignItems="center"
          mb={{ base: 14, md: 20 }}
        >
          <Box maxW="590px" textAlign="left">
            <Text
              fontSize="sm"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="brand.brown"
              fontWeight={600}
            >
              Open-source demo · by Development Seed
            </Text>
            <Heading
              textStyle="display"
              color="fg"
              mt={4}
              mb={5}
              css={{ textWrap: "balance" }}
            >
              Tell stories with cloud-native geospatial data.
            </Heading>
            <Text
              color="fg.muted"
              textStyle="body"
              fontSize="lg"
              mb={4}
              maxW="58ch"
            >
              Turn rasters, vectors, point clouds, and movement tracks into maps
              people can explore and stories they can share.
            </Text>
            <Text color="fg.subtle" fontSize="sm" lineHeight="tall" mb={7}>
              Not a hosted product. For production use, fork the repos or{" "}
              <a
                href={CONTACT_URL}
                style={{
                  color: "var(--chakra-colors-brand-orange)",
                  fontWeight: 600,
                }}
              >
                get in touch with Development Seed
              </a>
              .
            </Text>

            <Flex gap={4} align="center" wrap="wrap">
              <Button
                size="lg"
                bg="brand.orange"
                color="white"
                _hover={{ bg: "brand.orangeHover" }}
                onClick={startStory}
                loading={starting}
                disabled={starting}
              >
                Start a story <ArrowRight size={16} />
              </Button>
              <Button asChild size="lg" variant="plain">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <GithubLogo size={16} weight="bold" /> View on GitHub
                </a>
              </Button>
            </Flex>
          </Box>
          <Box minW={0}>
            {examplesStatus === "loading" ? (
              <Skeleton
                height={{ base: "310px", md: "430px" }}
                borderRadius="panel"
              />
            ) : examplesStatus === "error" ? (
              <StatePanel
                tone="danger"
                title="Couldn’t load example stories"
                description="The examples are temporarily unavailable. You can still start a new story."
                actionLabel="Try again"
                onAction={loadExamples}
              />
            ) : examples.length === 0 ? (
              <StatePanel
                title="No example stories available"
                description="Start a story with your own data while we prepare more examples."
              />
            ) : (
              <ExampleStoryCard
                title={examples[0].title}
                chapterCount={examples[0].chapters.length}
                dataType={inferDataType(examples[0])}
                onClick={() => openExampleStory(examples[0])}
                loading={cloningId === examples[0].id}
                featured
              />
            )}
          </Box>
        </Box>

        {(examplesStatus === "loading" || examples.length > 1) && (
          <Box maxW="1240px" mx="auto" mb={14}>
            <Text fontSize="sm" color="fg.muted" fontWeight={600} mb={4}>
              Example stories
            </Text>
            {examples.length === 0 ? (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                gap={5}
              >
                <Skeleton height="220px" borderRadius="panel" />
                <Skeleton height="220px" borderRadius="panel" />
              </Box>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                gap={5}
              >
                {examples.slice(1, 3).map((story) => (
                  <ExampleStoryCard
                    key={story.id}
                    title={story.title}
                    chapterCount={story.chapters.length}
                    dataType={inferDataType(story)}
                    onClick={() => openExampleStory(story)}
                    loading={cloningId === story.id}
                    compact={false}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        <Box
          maxW="960px"
          mx="auto"
          mb={10}
          py={6}
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="brand.border"
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={6}
        >
          <Box>
            <Text fontWeight={600} color="brand.brown" mb={1}>
              Want to build this for real?
            </Text>
            <Text fontSize="sm" color="gray.600" mb={2}>
              Development Seed builds production geospatial platforms. We
              open-sourced this sandbox to show what&apos;s possible.
            </Text>
            <a
              href={CONTACT_URL}
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Contact us →
            </a>
          </Box>
          <Box>
            <Text fontWeight={600} color="brand.brown" mb={1}>
              All code on GitHub
            </Text>
            <Text fontSize="sm" color="gray.600" mb={2}>
              CNG Sandbox, titiler-pgstac, stac-fastapi, tipg — fork, host,
              customize.
            </Text>
            <a
              href="https://github.com/developmentseed"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <ArrowSquareOut
                size={14}
                weight="bold"
                style={{
                  display: "inline",
                  marginRight: 4,
                  verticalAlign: "text-bottom",
                }}
                aria-hidden="true"
              />
              github.com/developmentseed
            </a>
          </Box>
        </Box>

        <Box maxW="560px" mx="auto" mb={6}>
          <Text fontSize="sm" fontWeight={600} color="gray.700" mb={2}>
            Have a workspace ID?
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Paste an ID you saved or one a collaborator shared with you.
          </Text>
          <Flex
            gap={2}
            as="form"
            onSubmit={(e) => {
              e.preventDefault();
              openExistingWorkspace();
            }}
          >
            <Input
              aria-label="Workspace ID"
              placeholder="e.g. abc12345"
              value={enteredId}
              onChange={(e) => setEnteredId(e.target.value)}
              size="md"
              bg="white"
            />
            <Button
              type="submit"
              size="md"
              variant="outline"
              borderColor="brand.border"
              color="brand.brown"
              _hover={{ bg: "brand.bgSubtle" }}
              disabled={!enteredId.trim()}
            >
              Open
            </Button>
          </Flex>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
}
