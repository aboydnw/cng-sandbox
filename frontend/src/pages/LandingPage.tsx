import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Flex, Heading, Input, Text } from "@chakra-ui/react";
import {
  ArrowRight,
  ArrowSquareOut,
  Browser,
  MapTrifold,
  Notebook,
} from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import {
  generateWorkspaceId,
  WORKSPACE_STORAGE_KEY,
} from "../hooks/useWorkspace";
import { seedExampleData } from "../lib/examples/api";
import { setWorkspaceId } from "../lib/api";

const EARTH_STORIES_URL = "https://github.com/aboydnw/earth-stories";

const PATHS = [
  {
    title: "Build a story",
    description:
      "Shape geospatial data, narrative, images, charts, and video into one focused editorial workflow.",
    icon: Notebook,
  },
  {
    title: "Publish and share",
    description:
      "Create portable, interactive stories designed to travel beyond the authoring environment.",
    icon: Browser,
  },
  {
    title: "Explore data in the browser",
    description:
      "Use CNG Sandbox to upload or connect geospatial sources and inspect them on a map right away.",
    icon: MapTrifold,
  },
] as const;

export default function LandingPage() {
  const navigate = useNavigate();
  const [enteredId, setEnteredId] = useState("");
  const [openingSandbox, setOpeningSandbox] = useState(false);

  const openSandbox = async () => {
    const storedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (storedId) {
      navigate(`/w/${storedId}/`);
      return;
    }

    setOpeningSandbox(true);
    const id = generateWorkspaceId();
    localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
    setWorkspaceId(id);
    try {
      await seedExampleData(id);
    } catch {
      // Seeding is best-effort; the workspace still opens.
    }
    navigate(`/w/${id}/`);
  };

  const openExistingWorkspace = () => {
    const trimmed = enteredId.trim();
    if (!trimmed) return;
    navigate(`/w/${trimmed}/`);
  };

  return (
    <Box minH="100vh" bg="brand.bgSubtle" display="flex" flexDirection="column">
      <Header showWorkspace={false} />

      <Box as="main" id="main-content" flex="1">
        <Box
          borderBottom="1px solid"
          borderColor="brand.border"
          px={{ base: 4, md: 6 }}
          py={{ base: 12, md: 20 }}
        >
          <Box maxW="1120px" mx="auto">
            <Box maxW="820px">
              <Text
                fontSize="xs"
                letterSpacing="0.16em"
                textTransform="uppercase"
                color="brand.brown"
                fontWeight={700}
              >
                Open-source science storytelling · by Development Seed
              </Text>
              <Heading
                as="h1"
                textStyle="display"
                color="fg"
                mt={5}
                mb={6}
                css={{ textWrap: "balance" }}
              >
                Earth Stories
              </Heading>
              <Text
                color="fg.muted"
                fontSize={{ base: "lg", md: "xl" }}
                lineHeight="tall"
                maxW="68ch"
              >
                Turn geospatial data into clear, publishable stories that
                combine maps, narrative, images, charts, and video.
              </Text>
              <Text color="fg.subtle" fontSize="sm" mt={4} maxW="64ch">
                Explore the source and current setup instructions on GitHub, or
                open the browser sandbox to work with geospatial data now.
              </Text>

              <Flex gap={3} align="center" wrap="wrap" mt={8}>
                <Button
                  asChild
                  size="lg"
                  bg="brand.orange"
                  color="white"
                  _hover={{ bg: "brand.orangeHover" }}
                >
                  <a
                    href={EARTH_STORIES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explore Earth Stories
                    <ArrowSquareOut size={17} aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  borderColor="brand.border"
                  color="brand.brown"
                  _hover={{ bg: "bg.raised" }}
                  onClick={openSandbox}
                  loading={openingSandbox}
                  disabled={openingSandbox}
                >
                  Open the data sandbox
                  <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </Flex>
            </Box>
          </Box>
        </Box>

        <Box px={{ base: 4, md: 6 }} py={{ base: 10, md: 14 }}>
          <Box
            maxW="1120px"
            mx="auto"
            display="grid"
            gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
            borderTop="1px solid"
            borderBottom="1px solid"
            borderColor="brand.border"
          >
            {PATHS.map(({ title, description, icon: Icon }, index) => (
              <Box
                key={title}
                py={8}
                px={{ base: 0, md: 7 }}
                borderTop={{
                  base: index === 0 ? "none" : "1px solid",
                  md: "none",
                }}
                borderLeft={{
                  base: "none",
                  md: index === 0 ? "none" : "1px solid",
                }}
                borderColor="brand.border"
              >
                <Icon size={24} color="var(--chakra-colors-brand-orange)" />
                <Heading as="h2" size="md" color="brand.brown" mt={4} mb={2}>
                  {title}
                </Heading>
                <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                  {description}
                </Text>
              </Box>
            ))}
          </Box>

          <Box maxW="560px" mx="auto" mt={{ base: 10, md: 14 }}>
            <Text fontSize="sm" fontWeight={700} color="brand.brown" mb={2}>
              Have a workspace ID?
            </Text>
            <Text fontSize="xs" color="fg.subtle" mb={3}>
              Paste an ID you saved or one a collaborator shared with you.
            </Text>
            <Flex
              gap={2}
              as="form"
              onSubmit={(event) => {
                event.preventDefault();
                openExistingWorkspace();
              }}
            >
              <Input
                aria-label="Workspace ID"
                placeholder="e.g. abc12345"
                value={enteredId}
                onChange={(event) => setEnteredId(event.target.value)}
                size="md"
                bg="bg.raised"
              />
              <Button
                type="submit"
                size="md"
                variant="outline"
                borderColor="brand.border"
                color="brand.brown"
                _hover={{ bg: "bg.raised" }}
                disabled={!enteredId.trim()}
              >
                Open
              </Button>
            </Flex>
          </Box>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
}
