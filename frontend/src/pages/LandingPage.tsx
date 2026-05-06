import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Input, Text } from "@chakra-ui/react";
import { ArrowRight, Rocket } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { generateWorkspaceId } from "../hooks/useWorkspace";

const STORAGE_KEY = "myWorkspaceId";

export default function LandingPage() {
  const navigate = useNavigate();
  const [enteredId, setEnteredId] = useState("");

  const createWorkspace = () => {
    const id = generateWorkspaceId();
    localStorage.setItem(STORAGE_KEY, id);
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

      <Box
        flex="1"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        py={12}
      >
        <Box maxW="560px" w="full" textAlign="center">
          <Flex
            justify="center"
            align="center"
            w="64px"
            h="64px"
            borderRadius="full"
            bg="orange.50"
            mx="auto"
            mb={5}
          >
            <Rocket
              size={32}
              weight="duotone"
              color="var(--chakra-colors-brand-orange)"
            />
          </Flex>

          <Heading size="xl" color="brand.brown" mb={3}>
            CNG Sandbox
          </Heading>
          <Text color="gray.700" fontSize="md" lineHeight="tall" mb={8}>
            A playground for the cloud-native geospatial stack. Upload a
            GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5 file and watch it get
            converted, tiled, and rendered as an interactive map &mdash; in
            seconds, in your browser.
          </Text>

          <Button
            size="lg"
            bg="brand.orange"
            color="white"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={createWorkspace}
            w="full"
            mb={4}
          >
            Create a new workspace
          </Button>

          <Box
            mt={6}
            pt={6}
            borderTop="1px solid"
            borderColor="brand.border"
            textAlign="left"
          >
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

          <Box mt={8}>
            <Link
              to="/about"
              style={{
                color: "var(--chakra-colors-brand-orange)",
                fontSize: "var(--chakra-fontSizes-sm)",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Learn more about CNG Sandbox <ArrowRight size={14} />
            </Link>
          </Box>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
}
