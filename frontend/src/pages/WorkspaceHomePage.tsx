import { Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { EarthStoriesCta } from "../components/EarthStoriesCta";
import { useWorkspace } from "../hooks/useWorkspace";
import { displayName } from "../utils/dataset";
import { timeAgo } from "../utils/format";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";
import { PageHeader } from "../components/PageHeader";
import { CREATE_MAP_INTENT } from "../lib/creationIntents";
import { useWorkspaceDatasets } from "../hooks/useWorkspaceLibrary";

function sortByUpdated<T extends { updated_at?: string; created_at?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export default function WorkspaceHomePage() {
  const { workspacePath } = useWorkspace();
  const datasetsResource = useWorkspaceDatasets();
  const userDatasets = datasetsResource.data.filter((d) => !d.is_example);
  const recentDatasets = sortByUpdated(userDatasets).slice(0, 3);
  const loading =
    datasetsResource.data.length === 0 &&
    datasetsResource.status === "loading";
  const resourceError = datasetsResource.error;
  const allUnavailable = datasetsResource.status === "error";
  const isEmpty = !loading && !resourceError && userDatasets.length === 0;

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box
        as="main"
        id="main-content"
        maxW="960px"
        mx="auto"
        py={8}
        px={4}
        w="100%"
        flex="1"
      >
        <PageHeader
          title="Your workspace"
          description="Return to a recent map or start something new."
          actions={
            <Button asChild size="sm">
              <Link to={workspacePath(CREATE_MAP_INTENT.path)}>
                {CREATE_MAP_INTENT.label}
              </Link>
            </Button>
          }
        />

        {resourceError && (
          <Flex
            role="alert"
            mb={6}
            p={4}
            gap={4}
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
            bg="status.danger.subtle"
            color="status.danger.fg"
            borderRadius="md"
          >
            <Box flex="1">
              <Text fontWeight={600}>Couldn’t load your workspace</Text>
              <Text fontSize="sm">{resourceError}</Text>
            </Box>
            <Button size="sm" variant="outline" onClick={datasetsResource.retry}>
              Try again
            </Button>
          </Flex>
        )}

        {loading ? (
          <CollectionSkeleton rows={4} />
        ) : allUnavailable ? null : isEmpty ? (
          <Box>
            <Heading textStyle="sectionTitle" color="fg" mb={2}>
              Start your first map
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Upload a file or connect cloud-native data to explore it on a
              map.
            </Text>
          </Box>
        ) : (
          <Section
            title="Recent data"
            viewAllLabel="View all data"
            viewAllHref={workspacePath("/data")}
            emptyText="No datasets yet."
          >
            {recentDatasets.map((dataset) => (
              <Row
                key={dataset.id}
                title={displayName(dataset)}
                href={workspacePath(`/map/${dataset.id}`)}
                meta={dataset.created_at ? timeAgo(dataset.created_at) : "—"}
              />
            ))}
          </Section>
        )}

        {!loading && !allUnavailable && (
          <Box mt={8}>
            <EarthStoriesCta />
          </Box>
        )}
      </Box>
      <Footer />
    </Flex>
  );
}

interface SectionProps {
  title: string;
  viewAllLabel: string;
  viewAllHref: string;
  emptyText: string;
  children: React.ReactNode;
}

function Section({
  title,
  viewAllLabel,
  viewAllHref,
  emptyText,
  children,
}: SectionProps) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md" color="gray.700">
          {title}
        </Heading>
      </Flex>
      {hasChildren ? (
        <Box>{children}</Box>
      ) : (
        <Text fontSize="sm" color="gray.500" mb={3}>
          {emptyText}
        </Text>
      )}
      <Link to={viewAllHref} style={{ textDecoration: "none" }}>
        <Flex
          align="center"
          gap={1}
          mt={3}
          fontSize="sm"
          color="brand.orange"
          fontWeight={500}
        >
          {viewAllLabel} <ArrowRight size={14} />
        </Flex>
      </Link>
    </Box>
  );
}

interface RowProps {
  title: string;
  href: string;
  meta: string;
}

function Row({ title, href, meta }: RowProps) {
  return (
    <Link to={href} style={{ textDecoration: "none" }}>
      <Flex
        justify="space-between"
        align="center"
        py={2}
        borderBottom="1px solid"
        borderColor="brand.border"
        _hover={{ bg: "brand.bgSubtle" }}
      >
        <Text color="brand.orange" fontWeight={500} truncate title={title}>
          {title}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {meta}
        </Text>
      </Flex>
    </Link>
  );
}
